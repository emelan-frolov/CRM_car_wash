from datetime import datetime, timedelta
from io import BytesIO
import json
import os
import threading
import time as _time
import uuid

from flask import Blueprint, jsonify, request, send_file

from excel_export import generate_orders_excel
from extensions import get_process_executor
from models import Order


bp = Blueprint("export", __name__)


EXPORT_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "exports"
)
EXPORT_META_FILE = os.path.join(EXPORT_DIR, "_jobs.json")

_export_jobs_lock = threading.Lock()
_active_futures = {}


def _ensure_export_dir():
    os.makedirs(EXPORT_DIR, exist_ok=True)


def _load_jobs():
    try:
        if os.path.exists(EXPORT_META_FILE):
            with open(EXPORT_META_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
    except Exception as e:
        print(f"Ошибка чтения {EXPORT_META_FILE }: {e }")
    return {}


def _save_jobs(jobs):
    try:
        _ensure_export_dir()
        with open(EXPORT_META_FILE, "w", encoding="utf-8") as f:
            json.dump(jobs, f, ensure_ascii=False)
    except Exception as e:
        print(f"Ошибка записи {EXPORT_META_FILE }: {e }")


def _update_job(job_id, **updates):
    with _export_jobs_lock:
        jobs = _load_jobs()
        if job_id in jobs:
            jobs[job_id].update(updates)
            _save_jobs(jobs)


def _get_job(job_id):
    with _export_jobs_lock:
        jobs = _load_jobs()
        return jobs.get(job_id)


def _delete_job(job_id):
    with _export_jobs_lock:
        jobs = _load_jobs()
        job = jobs.pop(job_id, None)
        if job:
            file_path = job.get("file_path")
            if file_path and os.path.exists(file_path):
                try:
                    os.remove(file_path)
                except Exception:
                    pass
        _save_jobs(jobs)
    _active_futures.pop(job_id, None)


def _cleanup_old_jobs():
    with _export_jobs_lock:
        jobs = _load_jobs()
        now = _time.time()
        to_delete = []
        for job_id, job in jobs.items():
            age = now - job.get("started_at", now)
            if age > 1800:
                to_delete.append(job_id)

        for job_id in to_delete:
            file_path = jobs[job_id].get("file_path")
            if file_path and os.path.exists(file_path):
                try:
                    os.remove(file_path)
                except Exception:
                    pass
            del jobs[job_id]

        if to_delete:
            _save_jobs(jobs)


def _run_export_job(job_id, orders_data):
    try:
        future = get_process_executor().submit(generate_orders_excel, orders_data)
        _active_futures[job_id] = future
        _update_job(job_id, status="processing")

        while not future.done():
            job = _get_job(job_id)
            if not job or job.get("cancelled"):
                future.cancel()
                _active_futures.pop(job_id, None)
                return

            elapsed = _time.time() - job["started_at"]
            estimated_total = max(5, len(orders_data) / 1000)
            progress = min(95, (elapsed / estimated_total) * 95)
            _update_job(job_id, progress=progress)

            try:
                future.result(timeout=0.5)
                break
            except Exception:
                pass

        excel_bytes = future.result()

        job = _get_job(job_id)
        if not job or job.get("cancelled"):
            _active_futures.pop(job_id, None)
            return

        _ensure_export_dir()
        file_path = os.path.join(EXPORT_DIR, f"{job_id }.xlsx")
        with open(file_path, "wb") as f:
            f.write(excel_bytes)

        _update_job(job_id, status="completed", progress=100, file_path=file_path)
        _active_futures.pop(job_id, None)

    except Exception as e:
        import traceback

        traceback.print_exc()
        _update_job(job_id, status="error", error=str(e))
        _active_futures.pop(job_id, None)


@bp.route("/api/orders/export/start", methods=["POST"])
def start_export():
    _cleanup_old_jobs()

    data = request.json or {}

    start_date_str = data.get("start_date")
    end_date_str = data.get("end_date")

    query = Order.query

    if start_date_str:
        try:
            start_dt = datetime.strptime(start_date_str, "%Y-%m-%d")
            query = query.filter(Order.created_at >= start_dt)
        except ValueError:
            return jsonify({"error": "Неверный формат start_date"}), 400

    if end_date_str:
        try:
            end_dt = datetime.strptime(end_date_str, "%Y-%m-%d") + timedelta(days=1)
            query = query.filter(Order.created_at < end_dt)
        except ValueError:
            return jsonify({"error": "Неверный формат end_date"}), 400

    orders = query.order_by(Order.created_at.desc()).all()
    orders_data = [order.to_dict() for order in orders]

    job_id = str(uuid.uuid4())
    filename = f"orders_export_{datetime .now ().strftime ('%Y%m%d_%H%M%S')}.xlsx"

    with _export_jobs_lock:
        jobs = _load_jobs()
        jobs[job_id] = {
            "status": "pending",
            "progress": 0,
            "total": len(orders_data),
            "error": None,
            "filename": filename,
            "cancelled": False,
            "started_at": _time.time(),
            "file_path": None,
        }
        _save_jobs(jobs)

    thread = threading.Thread(
        target=_run_export_job, args=(job_id, orders_data), daemon=True
    )
    thread.start()

    return jsonify({"job_id": job_id, "total": len(orders_data), "filename": filename})


@bp.route("/api/orders/export/status/<job_id>", methods=["GET"])
def export_status(job_id):
    job = _get_job(job_id)
    if not job:
        return jsonify({"error": "Job not found"}), 404

    return jsonify(
        {
            "job_id": job_id,
            "status": job["status"],
            "progress": round(job["progress"], 1),
            "total": job["total"],
            "error": job.get("error"),
            "filename": job["filename"],
        }
    )


@bp.route("/api/orders/export/download/<job_id>", methods=["GET"])
def export_download(job_id):
    job = _get_job(job_id)
    if not job:
        return jsonify({"error": "Job not found"}), 404
    if job["status"] != "completed":
        return jsonify({"error": "Job not completed yet", "status": job["status"]}), 400

    file_path = job.get("file_path")
    if not file_path or not os.path.exists(file_path):
        return jsonify({"error": "File not found"}), 404

    filename = job["filename"]

    def cleanup():
        _time.sleep(60)
        _delete_job(job_id)

    threading.Thread(target=cleanup, daemon=True).start()

    return send_file(
        file_path,
        mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        as_attachment=True,
        download_name=filename,
    )


@bp.route("/api/orders/export/cancel/<job_id>", methods=["POST"])
def export_cancel(job_id):
    job = _get_job(job_id)
    if not job:
        return jsonify({"error": "Job not found"}), 404

    _update_job(job_id, cancelled=True, status="cancelled")

    future = _active_futures.get(job_id)
    if future:
        future.cancel()
        _active_futures.pop(job_id, None)

    def delayed_cleanup():
        _time.sleep(2)
        _delete_job(job_id)

    threading.Thread(target=delayed_cleanup, daemon=True).start()

    return jsonify({"ok": True})


@bp.route("/api/orders/export", methods=["GET"])
def export_orders():

    start_date_str = request.args.get("start_date")
    end_date_str = request.args.get("end_date")

    query = Order.query

    if start_date_str:
        try:
            start_dt = datetime.strptime(start_date_str, "%Y-%m-%d")
            query = query.filter(Order.created_at >= start_dt)
        except ValueError:
            return (
                jsonify(
                    {"error": "Неверный формат start_date. Используйте YYYY-MM-DD"}
                ),
                400,
            )

    if end_date_str:
        try:

            end_dt = datetime.strptime(end_date_str, "%Y-%m-%d") + timedelta(days=1)
            query = query.filter(Order.created_at < end_dt)
        except ValueError:
            return (
                jsonify({"error": "Неверный формат end_date. Используйте YYYY-MM-DD"}),
                400,
            )

    orders = query.order_by(Order.created_at.desc()).all()
    orders_data = [order.to_dict() for order in orders]

    try:
        future = get_process_executor().submit(generate_orders_excel, orders_data)
        excel_bytes = future.result(timeout=120)
    except Exception as e:
        import traceback

        traceback.print_exc()
        return jsonify({"error": f"Ошибка генерации Excel: {str (e )}"}), 500

    output = BytesIO(excel_bytes)
    filename = f"orders_export_{datetime .now ().strftime ('%Y%m%d_%H%M%S')}.xlsx"

    return send_file(
        output,
        mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        as_attachment=True,
        download_name=filename,
    )
