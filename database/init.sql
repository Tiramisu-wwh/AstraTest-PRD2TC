-- PRD测试用例生成系统数据库初始化脚本

-- 创建数据库
CREATE DATABASE IF NOT EXISTS prd_test_system 
CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;

USE prd_test_system;

-- 文件上传表
CREATE TABLE file_uploads (
    id VARCHAR(36) PRIMARY KEY,
    session_id VARCHAR(36),
    file_name VARCHAR(255) NOT NULL,
    file_url TEXT NOT NULL,
    file_type VARCHAR(50),
    file_size BIGINT,
    upload_status VARCHAR(20) DEFAULT 'completed',
    extracted_content LONGTEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_session_id (session_id),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 测试用例表
CREATE TABLE test_cases (
    id VARCHAR(36) PRIMARY KEY,
    session_id VARCHAR(36),
    title VARCHAR(500) NOT NULL,
    group_name VARCHAR(255),
    maintainer VARCHAR(255),
    precondition TEXT,
    step_description TEXT,
    expected_result TEXT,
    case_level VARCHAR(50) DEFAULT '中',
    case_type VARCHAR(50) DEFAULT '功能测试',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_session_id (session_id),
    INDEX idx_created_at (created_at),
    INDEX idx_case_level (case_level),
    INDEX idx_case_type (case_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 会话表
CREATE TABLE chat_sessions (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36),
    title VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- AI配置表
CREATE TABLE ai_configurations (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36),
    provider VARCHAR(100) NOT NULL,
    api_endpoint TEXT NOT NULL,
    model_name VARCHAR(100) NOT NULL,
    api_key VARCHAR(500) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 插入默认AI配置（使用提供的阿里云千问配置）
INSERT INTO ai_configurations (
    id,
    user_id,
    provider,
    api_endpoint,
    model_name,
    api_key,
    is_active
) VALUES (
    UUID(),
    'default',
    '阿里云千问',
    'https://chat.r2ai.com.cn/v1',
    'qwen3',
    'sk-39f1ea53b129582a837d6223cceabb8e',
    TRUE
);

-- 创建示例会话
INSERT INTO chat_sessions (
    id,
    user_id,
    title
) VALUES (
    UUID(),
    'default',
    '示例项目分析'
);