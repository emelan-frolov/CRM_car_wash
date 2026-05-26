from datetime import datetime

import bcrypt

from extensions import db


class Settings(db.Model):
    __tablename__ = "settings"
    id = db.Column(db.Integer, primary_key=True)
    key = db.Column(db.String(50), unique=True, nullable=False)
    value = db.Column(db.String(200), nullable=False)

    def to_dict(self):
        return {"id": self.id, "key": self.key, "value": self.value}


class User(db.Model):

    __tablename__ = "users"
    id = db.Column(db.Integer, primary_key=True)
    login = db.Column(db.String(50), unique=True, nullable=False)
    password_hash = db.Column(db.String(200), nullable=False)
    full_name = db.Column(db.String(150), nullable=False)
    role = db.Column(db.String(20), nullable=False, default="admin")
    is_active = db.Column(db.Boolean, default=True)
    employee_id = db.Column(
        db.Integer, db.ForeignKey("employees.id"), nullable=True, unique=True
    )

    can_view_statistics = db.Column(db.Boolean, default=False, nullable=False)
    can_view_admin_schedule = db.Column(db.Boolean, default=False, nullable=False)
    can_view_positions = db.Column(db.Boolean, default=False, nullable=False)
    can_view_employees = db.Column(db.Boolean, default=False, nullable=False)
    can_create_employees = db.Column(db.Boolean, default=False, nullable=False)
    can_edit_employees = db.Column(db.Boolean, default=False, nullable=False)
    can_fire_employees = db.Column(db.Boolean, default=False, nullable=False)
    can_edit_services = db.Column(db.Boolean, default=False, nullable=False)
    can_view_services = db.Column(db.Boolean, default=False, nullable=False)
    can_create_services = db.Column(db.Boolean, default=False, nullable=False)
    can_delete_services = db.Column(db.Boolean, default=False, nullable=False)
    can_create_positions = db.Column(db.Boolean, default=False, nullable=False)
    can_edit_positions = db.Column(db.Boolean, default=False, nullable=False)
    can_delete_positions = db.Column(db.Boolean, default=False, nullable=False)
    can_export_orders = db.Column(db.Boolean, default=False, nullable=False)
    can_view_box_schedule = db.Column(db.Boolean, default=False, nullable=False)
    can_edit_box_schedule = db.Column(db.Boolean, default=False, nullable=False)
    can_edit_admin_schedule = db.Column(db.Boolean, default=False, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.now)
    last_login = db.Column(db.DateTime)

    employee = db.relationship("Employee", foreign_keys=[employee_id])

    def set_password(self, password):
        self.password_hash = bcrypt.hashpw(
            password.encode("utf-8"), bcrypt.gensalt()
        ).decode("utf-8")

    def check_password(self, password):
        try:
            return bcrypt.checkpw(
                password.encode("utf-8"), self.password_hash.encode("utf-8")
            )
        except Exception:
            return False

    def has_permission(self, permission):
        if self.role == "owner":
            return True
        return getattr(self, permission, False)

    def to_dict(self):

        is_owner = self.role == "owner"
        return {
            "id": self.id,
            "login": self.login,
            "full_name": self.full_name,
            "role": self.role,
            "is_active": self.is_active,
            "employee_id": self.employee_id,
            "employee_position": (
                self.employee.position.name
                if self.employee and self.employee.position
                else None
            ),
            "can_view_statistics": True if is_owner else bool(self.can_view_statistics),
            "can_view_admin_schedule": (
                True if is_owner else bool(self.can_view_admin_schedule)
            ),
            "can_view_positions": True if is_owner else bool(self.can_view_positions),
            "can_view_employees": True if is_owner else bool(self.can_view_employees),
            "can_create_employees": (
                True if is_owner else bool(self.can_create_employees)
            ),
            "can_edit_employees": True if is_owner else bool(self.can_edit_employees),
            "can_fire_employees": True if is_owner else bool(self.can_fire_employees),
            "can_edit_services": True if is_owner else bool(self.can_edit_services),
            "can_view_services": True if is_owner else bool(self.can_view_services),
            "can_create_services": True if is_owner else bool(self.can_create_services),
            "can_delete_services": True if is_owner else bool(self.can_delete_services),
            "can_create_positions": (
                True if is_owner else bool(self.can_create_positions)
            ),
            "can_edit_positions": True if is_owner else bool(self.can_edit_positions),
            "can_delete_positions": (
                True if is_owner else bool(self.can_delete_positions)
            ),
            "can_export_orders": True if is_owner else bool(self.can_export_orders),
            "can_view_box_schedule": (
                True if is_owner else bool(self.can_view_box_schedule)
            ),
            "can_edit_box_schedule": (
                True if is_owner else bool(self.can_edit_box_schedule)
            ),
            "can_edit_admin_schedule": (
                True if is_owner else bool(self.can_edit_admin_schedule)
            ),
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "last_login": self.last_login.isoformat() if self.last_login else None,
        }


class AdminSchedule(db.Model):

    __tablename__ = "admin_schedules"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    date = db.Column(db.Date, nullable=False, index=True)
    start_time = db.Column(db.Time, nullable=False)
    end_time = db.Column(db.Time, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.now)

    user = db.relationship("User", backref="admin_schedules")

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "user_login": self.user.login if self.user else None,
            "user_full_name": self.user.full_name if self.user else None,
            "date": self.date.isoformat() if self.date else None,
            "start_time": (
                self.start_time.strftime("%H:%M") if self.start_time else None
            ),
            "end_time": self.end_time.strftime("%H:%M") if self.end_time else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class Box(db.Model):
    __tablename__ = "boxes"
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), nullable=False)
    is_active = db.Column(db.Boolean, default=True)
    order_index = db.Column(db.Integer, default=0)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "is_active": self.is_active,
            "order_index": self.order_index,
        }


class Client(db.Model):
    __tablename__ = "clients"
    id = db.Column(db.Integer, primary_key=True)
    first_name = db.Column(db.String(50), nullable=False)
    last_name = db.Column(db.String(50), nullable=False)
    middle_name = db.Column(db.String(50))
    phone = db.Column(db.String(50), nullable=False)
    email = db.Column(db.String(100))
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.now)

    __table_args__ = (
        db.Index(
            "clients_phone_active_unique",
            "phone",
            unique=True,
            postgresql_where=(is_active.is_(True)),
        ),
    )

    def get_display_phone(self):
        if "_del_" in self.phone:
            return self.phone.split("_del_")[0]
        return self.phone

    def to_dict(self):
        return {
            "id": self.id,
            "first_name": self.first_name,
            "last_name": self.last_name,
            "middle_name": self.middle_name,
            "phone": self.get_display_phone(),
            "email": self.email,
            "is_active": self.is_active,
            "full_name": f"{self .last_name } {self .first_name } {self .middle_name or ''}".strip(),
            "created_at": self.created_at.isoformat(),
        }


class Car(db.Model):
    __tablename__ = "cars"
    id = db.Column(db.Integer, primary_key=True)
    license_plate = db.Column(db.String(50), nullable=False)
    brand = db.Column(db.String(50))
    model = db.Column(db.String(50))
    color = db.Column(db.String(30))
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.now)

    __table_args__ = (
        db.Index(
            "cars_license_plate_active_unique",
            "license_plate",
            unique=True,
            postgresql_where=(is_active.is_(True)),
        ),
    )

    def get_display_license_plate(self):
        if "_del_" in self.license_plate:
            return self.license_plate.split("_del_")[0]
        return self.license_plate

    def to_dict(self):
        display_plate = self.get_display_license_plate()
        return {
            "id": self.id,
            "license_plate": display_plate,
            "brand": self.brand,
            "model": self.model,
            "color": self.color,
            "is_active": self.is_active,
            "full_name": f"{self .brand or ''} {self .model or ''} ({display_plate })".strip(),
            "created_at": self.created_at.isoformat(),
        }


class Service(db.Model):
    __tablename__ = "services"
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text)
    price = db.Column(db.Float, nullable=False)
    duration = db.Column(db.Integer)
    washer_percentage = db.Column(db.Float, default=0)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.now)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "price": self.price,
            "duration": self.duration,
            "washer_percentage": self.washer_percentage,
            "washer_amount": (
                round(self.price * (self.washer_percentage / 100), 2)
                if self.washer_percentage
                else 0
            ),
            "is_active": self.is_active,
        }


class ServicePriceHistory(db.Model):

    __tablename__ = "service_price_history"
    id = db.Column(db.Integer, primary_key=True)
    service_id = db.Column(db.Integer, db.ForeignKey("services.id"), nullable=False)
    old_price = db.Column(db.Float)
    new_price = db.Column(db.Float, nullable=False)
    old_washer_percentage = db.Column(db.Float)
    new_washer_percentage = db.Column(db.Float)
    changed_by_user_id = db.Column(db.Integer, db.ForeignKey("users.id"))
    changed_at = db.Column(db.DateTime, default=datetime.now, nullable=False)

    service = db.relationship("Service", backref="price_history")
    changed_by = db.relationship("User")

    def to_dict(self):
        return {
            "id": self.id,
            "service_id": self.service_id,
            "old_price": self.old_price,
            "new_price": self.new_price,
            "old_washer_percentage": self.old_washer_percentage,
            "new_washer_percentage": self.new_washer_percentage,
            "changed_by_user_id": self.changed_by_user_id,
            "changed_at": self.changed_at.isoformat() if self.changed_at else None,
        }


class OrderService(db.Model):

    __tablename__ = "order_services"
    id = db.Column(db.Integer, primary_key=True)
    order_id = db.Column(db.Integer, db.ForeignKey("orders.id"), nullable=False)
    service_id = db.Column(db.Integer, db.ForeignKey("services.id"), nullable=False)

    service_price = db.Column(db.Float, nullable=True)
    washer_percentage = db.Column(db.Float, nullable=True)

    service = db.relationship("Service")

    def get_price(self):
        return (
            self.service_price
            if self.service_price is not None
            else (self.service.price if self.service else 0)
        )

    def get_washer_percentage(self):
        return (
            self.washer_percentage
            if self.washer_percentage is not None
            else (self.service.washer_percentage if self.service else 0)
        )


class Order(db.Model):
    __tablename__ = "orders"
    id = db.Column(db.Integer, primary_key=True)
    client_id = db.Column(db.Integer, db.ForeignKey("clients.id"), nullable=False)
    car_id = db.Column(db.Integer, db.ForeignKey("cars.id"), nullable=False)
    box_id = db.Column(db.Integer, db.ForeignKey("boxes.id"))
    employee_id = db.Column(db.Integer, db.ForeignKey("employees.id"))
    status = db.Column(db.String(20), default="pending", index=True)
    scheduled_time = db.Column(db.DateTime, index=True)
    completed_time = db.Column(db.DateTime)
    total_price = db.Column(db.Float)
    total_duration = db.Column(db.Integer)
    is_paid = db.Column(db.Boolean, default=False)
    notes = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.now, index=True)

    client = db.relationship("Client", backref="orders")
    car = db.relationship("Car", backref="orders")
    box = db.relationship("Box", backref="orders")
    employee = db.relationship("Employee", backref="orders")
    order_services = db.relationship(
        "OrderService", backref="order", cascade="all, delete-orphan"
    )

    def to_dict(self):
        services_list = [
            {
                "id": os.service.id if os.service else None,
                "name": os.service.name if os.service else "Услуга удалена",
                "price": os.get_price(),
                "duration": os.service.duration if os.service else None,
            }
            for os in self.order_services
        ]

        client_phone = self.client.get_display_phone() if self.client else None
        car_plate = self.car.get_display_license_plate() if self.car else None

        employee_name = None
        if self.employee:
            employee_name = (
                f"{self .employee .last_name } {self .employee .first_name }".strip()
            )

        return {
            "id": self.id,
            "client_id": self.client_id,
            "client_name": (
                f"{self .client .last_name } {self .client .first_name }"
                if self.client
                else None
            ),
            "client_phone": client_phone,
            "car_id": self.car_id,
            "car_license_plate": car_plate,
            "car_info": (
                f"{self .car .brand or ''} {self .car .model or ''}".strip()
                if self.car
                else None
            ),
            "services": services_list,
            "service_names": ", ".join([s["name"] for s in services_list]),
            "service_duration": self.total_duration,
            "box_id": self.box_id,
            "box_name": self.box.name if self.box else None,
            "employee_id": self.employee_id,
            "employee_name": employee_name,
            "status": self.status,
            "scheduled_time": (
                self.scheduled_time.isoformat() if self.scheduled_time else None
            ),
            "completed_time": (
                self.completed_time.isoformat() if self.completed_time else None
            ),
            "total_price": self.total_price,
            "total_duration": self.total_duration,
            "is_paid": self.is_paid,
            "notes": self.notes,
            "created_at": self.created_at.isoformat(),
        }


class Position(db.Model):

    __tablename__ = "positions"
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False, unique=True)
    salary = db.Column(db.Float, nullable=False)
    can_manage_system = db.Column(db.Boolean, default=False, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.now)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "salary": self.salary,
            "can_manage_system": bool(self.can_manage_system),
            "created_at": self.created_at.isoformat(),
        }


class Employee(db.Model):

    __tablename__ = "employees"
    id = db.Column(db.Integer, primary_key=True)
    first_name = db.Column(db.String(50), nullable=False)
    last_name = db.Column(db.String(50), nullable=False)
    middle_name = db.Column(db.String(50))
    phone = db.Column(db.String(20), unique=True, nullable=False)
    position_id = db.Column(db.Integer, db.ForeignKey("positions.id"), nullable=False)
    salary_type = db.Column(db.String(20), nullable=False)
    status = db.Column(db.String(20), default="active")
    sick_leave_start = db.Column(db.Date)
    sick_leave_end = db.Column(db.Date)
    fired_date = db.Column(db.Date)
    created_at = db.Column(db.DateTime, default=datetime.now)

    position = db.relationship("Position", backref="employees")

    def to_dict(self):

        status_display = {
            "active": "Работает",
            "sick_leave": "На больничном",
            "fired": "Уволен",
        }.get(self.status, self.status)

        return {
            "id": self.id,
            "first_name": self.first_name,
            "last_name": self.last_name,
            "middle_name": self.middle_name,
            "phone": self.phone,
            "position_id": self.position_id,
            "position_name": self.position.name if self.position else None,
            "position_salary": self.position.salary if self.position else None,
            "salary_type": self.salary_type,
            "salary_type_display": (
                "Фиксированная" if self.salary_type == "fixed" else "Сдельная"
            ),
            "status": self.status,
            "status_display": status_display,
            "sick_leave_start": (
                self.sick_leave_start.isoformat() if self.sick_leave_start else None
            ),
            "sick_leave_end": (
                self.sick_leave_end.isoformat() if self.sick_leave_end else None
            ),
            "fired_date": self.fired_date.isoformat() if self.fired_date else None,
            "full_name": f"{self .last_name } {self .first_name } {self .middle_name or ''}".strip(),
            "created_at": self.created_at.isoformat(),
        }


class BoxSchedule(db.Model):

    __tablename__ = "box_schedules"
    id = db.Column(db.Integer, primary_key=True)
    box_id = db.Column(db.Integer, db.ForeignKey("boxes.id"), nullable=False)
    employee_id = db.Column(db.Integer, db.ForeignKey("employees.id"), nullable=False)
    date = db.Column(db.Date, nullable=False)
    start_time = db.Column(db.Time, nullable=True)
    end_time = db.Column(db.Time, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.now)

    box = db.relationship("Box", backref="schedules")
    employee = db.relationship("Employee", backref="box_schedules")

    def to_dict(self):

        employee_name = None
        if self.employee:
            employee_name = f"{self .employee .last_name } {self .employee .first_name } {self .employee .middle_name or ''}".strip()

        return {
            "id": self.id,
            "box_id": self.box_id,
            "box_name": self.box.name if self.box else None,
            "employee_id": self.employee_id,
            "employee_name": employee_name,
            "employee_position": (
                self.employee.position.name
                if self.employee and self.employee.position
                else None
            ),
            "date": self.date.isoformat(),
            "start_time": (
                self.start_time.strftime("%H:%M") if self.start_time else None
            ),
            "end_time": self.end_time.strftime("%H:%M") if self.end_time else None,
            "created_at": self.created_at.isoformat(),
        }
