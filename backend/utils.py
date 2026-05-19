import atexit
from concurrent.futures import ProcessPoolExecutor

# Пул процессов для тяжелых CPU-задач (экспорт в Excel)
# Ленивая инициализация: создаётся при первом обращении, чтобы избежать
# проблем с Flask reloader на Windows (spawn пересоздаёт всё)
_process_executor = None


def get_process_executor():
    global _process_executor
    if _process_executor is None:
        _process_executor = ProcessPoolExecutor(max_workers=2)
    return _process_executor


def shutdown_executor():
    global _process_executor
    if _process_executor is not None:
        _process_executor.shutdown(wait=False, cancel_futures=True)
        _process_executor = None


atexit.register(shutdown_executor)
