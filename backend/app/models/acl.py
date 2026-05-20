from sqlalchemy import String, ForeignKey, Integer, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from ..db.session import Base


class ResourceACL(Base):
    """Resource-level ACL: who can view/use/edit a specific resource.

    subject_type: 'user' | 'group' | 'role'
    resource_type: 'agent' | 'document' | 'llm_provider' | 'tool'
    permission: 'view' | 'use' | 'edit' | 'admin'
    """
    __tablename__ = "resource_acls"
    __table_args__ = (UniqueConstraint("subject_type", "subject_id", "resource_type", "resource_id", "permission"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    subject_type: Mapped[str] = mapped_column(String(16))
    subject_id: Mapped[int] = mapped_column(Integer)
    resource_type: Mapped[str] = mapped_column(String(32))
    resource_id: Mapped[int] = mapped_column(Integer)
    permission: Mapped[str] = mapped_column(String(16))
