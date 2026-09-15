from logging.config import fileConfig

from alembic import context
from sqlalchemy import create_engine, pool

import app.models  # noqa: F401 — import để Base.metadata nhìn thấy đủ bảng
from app.config import DATABASE_URL
from app.db import Base

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def include_object(obj, name, type_, reflected, compare_to) -> bool:
    """Chỉ quản lý bảng do project khai báo.

    Image PostGIS tạo sẵn hàng chục bảng (tiger geocoder, spatial_ref_sys...) nằm trong
    search_path; không lọc thì autogenerate sinh ra hàng loạt lệnh drop_table cho chúng.
    Đánh đổi: khi xóa hẳn một model, phải tự viết lệnh drop trong migration thay vì để
    autogenerate sinh — chấp nhận được, đổi lại không bao giờ vô tình drop bảng của extension.
    """
    if not reflected:
        return True
    if type_ == "table":
        return name in target_metadata.tables
    parent = getattr(obj, "table", None)
    return parent is None or parent.name in target_metadata.tables


def run_migrations_offline() -> None:
    context.configure(
        url=DATABASE_URL,
        target_metadata=target_metadata,
        literal_binds=True,
        include_object=include_object,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    # Dùng thẳng DATABASE_URL thay vì alembic.ini: tránh configparser hiểu nhầm ký tự '%'
    # trong password do Render sinh ra.
    connectable = create_engine(DATABASE_URL, poolclass=pool.NullPool)
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            include_object=include_object,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
