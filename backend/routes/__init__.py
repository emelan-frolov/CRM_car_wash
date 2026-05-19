def register_blueprints(app):
    """Регистрирует все Blueprint'ы приложения."""
    from routes.auth import bp as auth_bp
    from routes.users import bp as users_bp
    from routes.clients import bp as clients_bp
    from routes.cars import bp as cars_bp
    from routes.services import bp as services_bp
    from routes.boxes import bp as boxes_bp
    from routes.positions import bp as positions_bp
    from routes.employees import bp as employees_bp
    from routes.orders import bp as orders_bp
    from routes.schedule import bp as schedule_bp
    from routes.statistics import bp as statistics_bp
    from routes.public import bp as public_bp
    from routes.exports import bp as exports_bp
    from routes.health import bp as health_bp

    for blueprint in [auth_bp, users_bp, clients_bp, cars_bp, services_bp,
                      boxes_bp, positions_bp, employees_bp, orders_bp,
                      schedule_bp, statistics_bp, public_bp, exports_bp, health_bp]:
        app.register_blueprint(blueprint)
