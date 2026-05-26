import os

from flask import Flask
from flask_cors import CORS

from config import Config
from extensions import db
from models import Box, User


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    CORS(
        app,
        resources={
            r"/api/*": {
                "origins": "*",
                "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
                "allow_headers": ["Content-Type", "Authorization"],
                "expose_headers": ["Content-Disposition"],
            }
        },
    )

    db.init_app(app)
    register_blueprints(app)
    return app


def register_blueprints(app):
    from routes.admin_schedule_routes import bp as admin_schedules_bp
    from routes.auth_routes import bp as auth_bp
    from routes.booking_routes import bp as booking_bp
    from routes.box_schedule_routes import bp as box_schedules_bp
    from routes.boxes_settings_routes import bp as boxes_settings_bp
    from routes.cars_routes import bp as cars_bp
    from routes.clients_routes import bp as clients_bp
    from routes.export_routes import bp as export_bp
    from routes.health_routes import bp as health_bp
    from routes.orders_routes import bp as orders_bp
    from routes.positions_employees_routes import bp as positions_employees_bp
    from routes.services_routes import bp as services_bp
    from routes.stats_routes import bp as stats_bp

    blueprints = [
        health_bp,
        auth_bp,
        admin_schedules_bp,
        stats_bp,
        clients_bp,
        cars_bp,
        services_bp,
        boxes_settings_bp,
        export_bp,
        orders_bp,
        positions_employees_bp,
        box_schedules_bp,
        booking_bp,
    ]
    for bp in blueprints:
        app.register_blueprint(bp)


def initialize_database(app):
    with app.app_context():
        db.create_all()

        if Box.query.count() == 0:
            default_boxes = [
                Box(name="Бокс 1", order_index=0),
                Box(name="Бокс 2", order_index=1),
                Box(name="Бокс 3", order_index=2),
            ]
            for box in default_boxes:
                db.session.add(box)
            db.session.commit()
            print("Созданы боксы по умолчанию")

        if not User.query.filter_by(role="owner").first():
            default_owner_login = os.getenv("DEFAULT_OWNER_LOGIN", "owner")
            default_owner_password = os.getenv("DEFAULT_OWNER_PASSWORD", "owner123")
            owner = User(
                login=default_owner_login,
                full_name="Владелец",
                role="owner",
                is_active=True,
            )
            owner.set_password(default_owner_password)
            db.session.add(owner)
            db.session.commit()
            print("=" * 60)
            print("СОЗДАН ВЛАДЕЛЕЦ ПО УМОЛЧАНИЮ")
            print(f"   Логин:  {default_owner_login }")
            print(f"   Пароль: {default_owner_password }")
            print("    ОБЯЗАТЕЛЬНО смените пароль после первого входа!")
            print("=" * 60)


app = create_app()


if __name__ == "__main__":
    initialize_database(app)
    app.run(debug=True, port=5000, use_reloader=False)
