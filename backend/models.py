from sqlalchemy import Column, String, Text, BigInteger, Boolean, DateTime, func
from sqlalchemy.dialects.mysql import LONGTEXT
from database import Base

class FileUpload(Base):
    __tablename__ = "file_uploads"
    
    id = Column(String(36), primary_key=True)
    session_id = Column(String(36))
    file_name = Column(String(255), nullable=False)
    file_url = Column(Text, nullable=False)
    file_type = Column(String(100))
    file_size = Column(BigInteger)
    upload_status = Column(String(20), default="completed")
    extracted_content = Column(LONGTEXT)
    created_at = Column(DateTime, server_default=func.now())

class TestCase(Base):
    __tablename__ = "test_cases"

    id = Column(String(36), primary_key=True)
    session_id = Column(String(36))
    title = Column(String(500), nullable=False)
    group_name = Column(String(255))
    maintainer = Column(String(255))
    precondition = Column(Text)
    step_description = Column(Text)
    expected_result = Column(Text)
    case_level = Column(String(50))
    case_type = Column(String(50))
    ai_order = Column(BigInteger)  # AI返回的原始顺序
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

class ChatSession(Base):
    __tablename__ = "chat_sessions"

    id = Column(String(36), primary_key=True)
    user_id = Column(String(36))
    title = Column(String(255), nullable=False)
    file_id = Column(String(36))  # 关联的文件ID
    file_name = Column(String(255))  # 原始文件名
    is_deleted = Column(Boolean, default=False)  # 软删除标记
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

class AIConfiguration(Base):
    __tablename__ = "ai_configurations"
    
    id = Column(String(36), primary_key=True)
    user_id = Column(String(36))
    provider = Column(String(100), nullable=False)
    api_endpoint = Column(Text, nullable=False)
    model_name = Column(String(100), nullable=False)
    api_key = Column(String(500), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())