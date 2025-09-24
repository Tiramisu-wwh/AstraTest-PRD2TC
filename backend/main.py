from fastapi import FastAPI, HTTPException, Depends, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
import uvicorn
from sqlalchemy.orm import Session
import uuid
import os
from datetime import datetime
from typing import List, Optional
import json
import httpx
import asyncio

from database import SessionLocal, engine, Base
from models import FileUpload, TestCase, ChatSession, AIConfiguration
from schemas import (
    FileUploadResponse, TestCaseCreate, TestCaseUpdate, TestCaseResponse,
    ChatSessionCreate, ChatSessionUpdate, ChatSessionResponse, AIConfigurationCreate, AIConfigurationResponse,
    AnalyzeRequest, AnalyzeResponse
)
from utils.file_processor import process_file
from utils.ai_client import analyze_with_ai_enhanced
import asyncio
from typing import Dict
import logging

# 配置日志
logging.basicConfig(
    level=logging.DEBUG,  # 设置为DEBUG级别以显示所有日志
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('../logs/backend.log', encoding='utf-8'),
        logging.StreamHandler()  # 同时输出到控制台
    ]
)

# 创建数据库表
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="PRD测试用例生成系统",
    description="基于AI的PRD文档测试用例自动生成系统",
    version="1.0.0"
)

# 配置CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],  # React开发服务器
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 静态文件服务
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# 分析进度跟踪
analysis_progress: Dict[str, str] = {}

# 数据库依赖
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# 确保上传目录存在
os.makedirs("uploads", exist_ok=True)

@app.get("/")
async def root():
    return {"message": "PRD测试用例生成系统 API"}

@app.post("/api/upload", response_model=FileUploadResponse)
async def upload_file(
    file: UploadFile = File(...),
    session_id: str = Form(...),
    db: Session = Depends(get_db)
):
    """文件上传和内容提取"""
    try:
        # 生成唯一文件名
        file_id = str(uuid.uuid4())
        file_extension = os.path.splitext(file.filename)[1]
        unique_filename = f"{file_id}{file_extension}"
        file_path = os.path.join("uploads", unique_filename)
        
        # 保存文件
        content = await file.read()
        with open(file_path, "wb") as f:
            f.write(content)
        
        # 提取文件内容
        extracted_content = await process_file(file_path, file.content_type)
        
        # 保存到数据库
        db_file = FileUpload(
            id=file_id,
            session_id=session_id,
            file_name=file.filename,
            file_url=f"/uploads/{unique_filename}",
            file_type=file.content_type,
            file_size=len(content),
            upload_status="completed",
            extracted_content=extracted_content
        )
        db.add(db_file)
        db.commit()
        db.refresh(db_file)

        # 更新会话标题为文档名+测试用例格式
        try:
            session = db.query(ChatSession).filter(ChatSession.id == session_id).first()
            if session:
                new_title = generate_session_title(file.filename)
                session.title = new_title
                session.file_id = file_id
                session.file_name = file.filename
                db.commit()
                logging.info(f"会话标题已更新: {new_title}")
        except Exception as e:
            logging.warning(f"更新会话标题失败: {e}")

        return FileUploadResponse(
            id=db_file.id,
            session_id=db_file.session_id,
            file_name=db_file.file_name,
            file_url=db_file.file_url,
            file_type=db_file.file_type,
            file_size=db_file.file_size,
            upload_status=db_file.upload_status,
            extracted_content=db_file.extracted_content,
            created_at=db_file.created_at
        )
    
    except Exception as e:
        import traceback
        error_detail = f"文件上传失败: {str(e)}\n详细错误: {traceback.format_exc()}"
        print(f"[ERROR] {error_detail}")
        raise HTTPException(status_code=500, detail=error_detail)

# 辅助函数：生成自动会话名称
def generate_session_title(file_name: str) -> str:
    """根据文件名生成会话标题"""
    if not file_name:
        return "新测试用例分析"

    # 移除文件扩展名
    base_name = os.path.splitext(file_name)[0]

    # 如果文件名已经包含"测试用例"，直接返回
    if "测试用例" in base_name:
        return base_name

    # 否则添加"测试用例"后缀
    return f"{base_name}测试用例"

@app.post("/api/analyze", response_model=AnalyzeResponse)
async def analyze_document(
    request: AnalyzeRequest,
    db: Session = Depends(get_db)
):
    """AI分析生成测试用例"""
    try:
        # 获取文件内容
        file_upload = db.query(FileUpload).filter(FileUpload.id == request.file_id).first()
        if not file_upload:
            raise HTTPException(status_code=404, detail="文件未找到")
        
        # 获取AI配置
        ai_config = db.query(AIConfiguration).filter(AIConfiguration.is_active == True).first()
        if not ai_config:
            raise HTTPException(status_code=400, detail="请先配置AI服务")
        
        # 调用AI分析（使用增强版，支持大文档分块分析）

        # 定义进度回调函数
        def progress_callback(message: str):
            # 这里可以添加WebSocket或SSE推送逻辑
            logging.info(f"分析进度: {message}")
            # 将进度保存到内存中，可以通过另一个接口查询
            analysis_progress[request.file_id] = message

        test_cases = await analyze_with_ai_enhanced(
            content=file_upload.extracted_content,
            ai_config=ai_config,
            progress_callback=progress_callback
        )
        
        # 检查是否生成了有效的测试用例
        if not test_cases:
            raise Exception("AI未能生成任何有效的测试用例。请检查文档内容是否包含明确的功能需求，或AI服务配置是否正确。")

        # 保存测试用例到数据库
        saved_cases = []
        for order_index, case_data in enumerate(test_cases):
            db_case = TestCase(
                id=str(uuid.uuid4()),
                session_id=request.session_id,
                title=case_data.get("title", ""),
                group_name=case_data.get("group_name", ""),
                maintainer=case_data.get("maintainer", ""),
                precondition=case_data.get("precondition", ""),
                step_description=case_data.get("step_description", ""),
                expected_result=case_data.get("expected_result", ""),
                case_level=case_data.get("case_level", "中"),
                case_type=case_data.get("case_type", "功能测试"),
                ai_order=order_index  # 保存AI返回的原始顺序
            )
            db.add(db_case)
            saved_cases.append(db_case)

        db.commit()

        return AnalyzeResponse(
            success=True,
            message="AI分析完成",
            test_cases_count=len(saved_cases)
        )
    
    except Exception as e:
        # 提供详细的错误信息，包括AI分析失败的具体原因
        error_msg = str(e)
        if "AI" in error_msg:
            raise HTTPException(status_code=500, detail=f"AI分析失败: {error_msg}")
        else:
            raise HTTPException(status_code=500, detail=f"系统处理失败: {error_msg}")

@app.get("/api/analysis-progress/{file_id}")
async def get_analysis_progress(file_id: str):
    """获取AI分析进度"""
    progress = analysis_progress.get(file_id, "未开始分析")
    return {"file_id": file_id, "progress": progress}

@app.get("/api/test-cases/{session_id}", response_model=List[TestCaseResponse])
async def get_test_cases(session_id: str, db: Session = Depends(get_db)):
    """获取测试用例列表"""
    cases = db.query(TestCase).filter(TestCase.session_id == session_id).order_by(TestCase.ai_order.asc(), TestCase.created_at.asc()).all()
    return [TestCaseResponse(
        id=case.id,
        session_id=case.session_id,
        title=case.title,
        group_name=case.group_name,
        maintainer=case.maintainer,
        precondition=case.precondition,
        step_description=case.step_description,
        expected_result=case.expected_result,
        case_level=case.case_level,
        case_type=case.case_type,
        ai_order=case.ai_order,
        created_at=case.created_at,
        updated_at=case.updated_at
    ) for case in cases]

@app.post("/api/test-cases", response_model=TestCaseResponse)
async def create_test_case(case: TestCaseCreate, db: Session = Depends(get_db)):
    """创建测试用例"""
    db_case = TestCase(
        id=str(uuid.uuid4()),
        **case.model_dump()
    )
    db.add(db_case)
    db.commit()
    db.refresh(db_case)
    
    return TestCaseResponse(
        id=db_case.id,
        session_id=db_case.session_id,
        title=db_case.title,
        group_name=db_case.group_name,
        maintainer=db_case.maintainer,
        precondition=db_case.precondition,
        step_description=db_case.step_description,
        expected_result=db_case.expected_result,
        case_level=db_case.case_level,
        case_type=db_case.case_type,
        ai_order=db_case.ai_order,
        created_at=db_case.created_at,
        updated_at=db_case.updated_at
    )

@app.put("/api/test-cases/{case_id}", response_model=TestCaseResponse)
async def update_test_case(
    case_id: str,
    case_update: TestCaseUpdate,
    db: Session = Depends(get_db)
):
    """更新测试用例"""
    db_case = db.query(TestCase).filter(TestCase.id == case_id).first()
    if not db_case:
        raise HTTPException(status_code=404, detail="测试用例未找到")
    
    update_data = case_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_case, field, value)
    
    db.commit()
    db.refresh(db_case)
    
    return TestCaseResponse(
        id=db_case.id,
        session_id=db_case.session_id,
        title=db_case.title,
        group_name=db_case.group_name,
        maintainer=db_case.maintainer,
        precondition=db_case.precondition,
        step_description=db_case.step_description,
        expected_result=db_case.expected_result,
        case_level=db_case.case_level,
        case_type=db_case.case_type,
        ai_order=db_case.ai_order,
        created_at=db_case.created_at,
        updated_at=db_case.updated_at
    )

@app.delete("/api/test-cases/{case_id}")
async def delete_test_case(case_id: str, db: Session = Depends(get_db)):
    """删除测试用例"""
    db_case = db.query(TestCase).filter(TestCase.id == case_id).first()
    if not db_case:
        raise HTTPException(status_code=404, detail="测试用例未找到")
    
    db.delete(db_case)
    db.commit()
    
    return {"message": "测试用例已删除"}

@app.get("/api/sessions", response_model=List[ChatSessionResponse])
async def get_sessions(db: Session = Depends(get_db)):
    """获取会话列表（不包括已删除的）"""
    sessions = db.query(ChatSession).filter(ChatSession.is_deleted == False).order_by(ChatSession.created_at.desc()).all()
    return [ChatSessionResponse(
        id=session.id,
        user_id=session.user_id,
        title=session.title,
        file_id=session.file_id,
        file_name=session.file_name,
        is_deleted=session.is_deleted,
        created_at=session.created_at,
        updated_at=session.updated_at
    ) for session in sessions]

@app.post("/api/sessions", response_model=ChatSessionResponse)
async def create_session(session: ChatSessionCreate, db: Session = Depends(get_db)):
    """创建新会话"""
    db_session = ChatSession(
        id=str(uuid.uuid4()),
        user_id=session.user_id or "default",
        title=session.title,
        file_id=session.file_id,
        file_name=session.file_name
    )
    db.add(db_session)
    db.commit()
    db.refresh(db_session)

    return ChatSessionResponse(
        id=db_session.id,
        user_id=db_session.user_id,
        title=db_session.title,
        file_id=db_session.file_id,
        file_name=db_session.file_name,
        is_deleted=db_session.is_deleted,
        created_at=db_session.created_at,
        updated_at=db_session.updated_at
    )

@app.put("/api/sessions/{session_id}", response_model=ChatSessionResponse)
async def update_session(
    session_id: str,
    session_update: ChatSessionUpdate,
    db: Session = Depends(get_db)
):
    """更新会话信息"""
    db_session = db.query(ChatSession).filter(ChatSession.id == session_id, ChatSession.is_deleted == False).first()
    if not db_session:
        raise HTTPException(status_code=404, detail="会话未找到")

    update_data = session_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_session, field, value)

    db.commit()
    db.refresh(db_session)

    return ChatSessionResponse(
        id=db_session.id,
        user_id=db_session.user_id,
        title=db_session.title,
        file_id=db_session.file_id,
        file_name=db_session.file_name,
        is_deleted=db_session.is_deleted,
        created_at=db_session.created_at,
        updated_at=db_session.updated_at
    )

@app.delete("/api/sessions/{session_id}")
async def delete_session(session_id: str, db: Session = Depends(get_db)):
    """删除会话（软删除）并删除关联的测试用例"""
    db_session = db.query(ChatSession).filter(ChatSession.id == session_id, ChatSession.is_deleted == False).first()
    if not db_session:
        raise HTTPException(status_code=404, detail="会话未找到")

    try:
        # 删除该会话关联的所有测试用例
        db.query(TestCase).filter(TestCase.session_id == session_id).delete()

        # 软删除会话
        db_session.is_deleted = True
        db.commit()

        return {"message": "会话已删除"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"删除会话失败: {str(e)}")

@app.get("/api/ai-config", response_model=List[AIConfigurationResponse])
async def get_ai_configs(db: Session = Depends(get_db)):
    """获取AI配置列表"""
    configs = db.query(AIConfiguration).all()
    return [AIConfigurationResponse(
        id=config.id,
        user_id=config.user_id,
        provider=config.provider,
        api_endpoint=config.api_endpoint,
        model_name=config.model_name,
        api_key="***" + config.api_key[-4:] if config.api_key else "",  # 隐藏API密钥
        is_active=config.is_active,
        created_at=config.created_at,
        updated_at=config.updated_at
    ) for config in configs]

@app.post("/api/ai-config", response_model=AIConfigurationResponse)
async def create_ai_config(config: AIConfigurationCreate, db: Session = Depends(get_db)):
    """创建AI配置"""
    # 如果设置为活跃，先将其他配置设为非活跃
    if config.is_active:
        db.query(AIConfiguration).update({"is_active": False})
    
    db_config = AIConfiguration(
        id=str(uuid.uuid4()),
        user_id=config.user_id or "default",
        provider=config.provider,
        api_endpoint=config.api_endpoint,
        model_name=config.model_name,
        api_key=config.api_key,
        is_active=config.is_active
    )
    db.add(db_config)
    db.commit()
    db.refresh(db_config)
    
    return AIConfigurationResponse(
        id=db_config.id,
        user_id=db_config.user_id,
        provider=db_config.provider,
        api_endpoint=db_config.api_endpoint,
        model_name=db_config.model_name,
        api_key="***" + db_config.api_key[-4:],
        is_active=db_config.is_active,
        created_at=db_config.created_at,
        updated_at=db_config.updated_at
    )

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)