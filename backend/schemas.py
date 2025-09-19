from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List

# FileUpload schemas
class FileUploadResponse(BaseModel):
    id: str
    session_id: str
    file_name: str
    file_url: str
    file_type: Optional[str]
    file_size: Optional[int]
    upload_status: str
    extracted_content: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True

# TestCase schemas
class TestCaseBase(BaseModel):
    title: str
    group_name: Optional[str] = None
    maintainer: Optional[str] = None
    precondition: Optional[str] = None
    step_description: Optional[str] = None
    expected_result: Optional[str] = None
    case_level: Optional[str] = "中"
    case_type: Optional[str] = "功能测试"

class TestCaseCreate(TestCaseBase):
    session_id: str

class TestCaseUpdate(BaseModel):
    title: Optional[str] = None
    group_name: Optional[str] = None
    maintainer: Optional[str] = None
    precondition: Optional[str] = None
    step_description: Optional[str] = None
    expected_result: Optional[str] = None
    case_level: Optional[str] = None
    case_type: Optional[str] = None

class TestCaseResponse(TestCaseBase):
    id: str
    session_id: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# ChatSession schemas
class ChatSessionCreate(BaseModel):
    title: str
    user_id: Optional[str] = None

class ChatSessionResponse(BaseModel):
    id: str
    user_id: str
    title: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# AIConfiguration schemas
class AIConfigurationCreate(BaseModel):
    provider: str
    api_endpoint: str
    model_name: str
    api_key: str
    user_id: Optional[str] = None
    is_active: bool = True

class AIConfigurationResponse(BaseModel):
    id: str
    user_id: str
    provider: str
    api_endpoint: str
    model_name: str
    api_key: str  # 已在API中处理隐藏
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# Analysis schemas
class AnalyzeRequest(BaseModel):
    file_id: str
    session_id: str

class AnalyzeResponse(BaseModel):
    success: bool
    message: str
    test_cases_count: int