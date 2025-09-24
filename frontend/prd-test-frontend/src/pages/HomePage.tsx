import React, { useState, useCallback } from 'react';
import {
  Card,
  Upload,
  Button,
  Alert,
  Typography,
  Space,
  message,
  Spin,
  Progress,
  Tag,
  Modal,
} from 'antd';
import {
  InboxOutlined,
  FileTextOutlined,
  RobotOutlined,
  CheckCircleOutlined,
  ReloadOutlined,
  EyeOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../contexts/SessionContext';
import { useUploadFile, useAnalyzeDocument } from '../hooks/useApi';
import { api } from '../lib/api';
import type { UploadProps } from 'antd';

const { Title, Text, Paragraph } = Typography;
const { Dragger } = Upload;

// 文件类型配置
const FILE_CONFIG = {
  maxSize: 10 * 1024 * 1024, // 10MB
  types: ['.pdf', '.docx', '.doc', '.txt', '.md'],
  descriptions: {
    '.pdf': 'PDF文档',
    '.docx': 'Word文档',
    '.doc': 'Word文档',
    '.txt': '文本文件',
    '.md': 'Markdown文件',
  },
};

const HomePage: React.FC = () => {
  const { currentSession, isLoading: sessionLoading, setCurrentSession, setSessions } = useSession();
  const navigate = useNavigate();
  const [uploadedFile, setUploadedFile] = useState<any>(null);
  const [extractedContent, setExtractedContent] = useState<string>('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const uploadMutation = useUploadFile();
  const analyzeMutation = useAnalyzeDocument();

  // 文件验证
  const validateFile = (file: File): boolean => {
    const fileExtension = `.${file.name.split('.').pop()?.toLowerCase()}`;

    if (!FILE_CONFIG.types.includes(fileExtension)) {
      message.error(`不支持的文件格式，请上传以下格式的文件：${FILE_CONFIG.types.join('、')}`);
      return false;
    }

    if (file.size > FILE_CONFIG.maxSize) {
      message.error(`文件大小不能超过 ${FILE_CONFIG.maxSize / 1024 / 1024}MB`);
      return false;
    }

    return true;
  };

  const uploadProps: UploadProps = {
    name: 'file',
    multiple: false,
    accept: FILE_CONFIG.types.join(','),
    beforeUpload: (file) => {
      return validateFile(file) ? true : Upload.LIST_IGNORE;
    },
    onChange: (info) => {
      if (info.fileList.length > 0) {
        setUploadedFile(info.fileList[0]);
      } else {
        setUploadedFile(null);
        setExtractedContent('');
        setUploadProgress(0);
        setAnalysisProgress(0);
      }
    },
    onDrop: (e) => {
      console.log('Dropped files', e.dataTransfer.files);
    },
    showUploadList: false,
  };

  const handleUpload = async () => {
    if (!uploadedFile || !currentSession) {
      message.error('请选择文件和会话');
      return;
    }

    try {
      // 模拟上传进度
      setUploadProgress(0);
      const progressTimer = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressTimer);
            return 90;
          }
          return prev + 10;
        });
      }, 100);

      const result = await uploadMutation.mutateAsync({
        file: uploadedFile.originFileObj,
        sessionId: currentSession.id,
      });

      clearInterval(progressTimer);
      setUploadProgress(100);
      setExtractedContent(result.extracted_content || '');

      // 更新文件状态
      setUploadedFile(prev => ({
        ...prev,
        uploaded: true,
        fileId: result.id,
      }));

      // 刷新会话列表和当前会话（因为后端可能更新了会话标题）
      try {
        const updatedSessions = await api.getSessions();
        setSessions(updatedSessions);

        // 更新当前会话信息
        const updatedCurrentSession = updatedSessions.find(s => s.id === currentSession?.id);
        if (updatedCurrentSession) {
          setCurrentSession(updatedCurrentSession);
        }
      } catch (refreshError) {
        console.warn('刷新会话列表失败:', refreshError);
      }

      message.success('文件上传成功！');
    } catch (error) {
      setUploadProgress(0);
      message.error('文件上传失败，请重试');
    }
  };

  const handleAnalyze = async () => {
    if (!uploadedFile?.fileId || !currentSession) {
      message.error('请先上传文件');
      return;
    }

    setIsAnalyzing(true);
    setAnalysisProgress(0);

    // 模拟分析进度
    const analysisTimer = setInterval(() => {
      setAnalysisProgress(prev => {
        if (prev >= 90) {
          clearInterval(analysisTimer);
          return 90;
        }
        return prev + Math.random() * 15;
      });
    }, 500);

    try {
      await analyzeMutation.mutateAsync({
        fileId: uploadedFile.fileId,
        sessionId: currentSession.id,
      });

      clearInterval(analysisTimer);
      setAnalysisProgress(100);
      message.success('AI分析完成！');

      // 显示结果提示
      Modal.success({
        title: '分析完成',
        content: 'AI已成功生成测试用例，是否立即查看？',
        okText: '查看测试用例',
        cancelText: '稍后再看',
        onOk: () => navigate('/test-cases'),
      });
    } catch (error) {
      clearInterval(analysisTimer);
      setAnalysisProgress(0);
      message.error('AI分析失败，请重试');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleRemoveFile = () => {
    setUploadedFile(null);
    setExtractedContent('');
    setUploadProgress(0);
    setAnalysisProgress(0);
  };

  const getFileIcon = (fileName: string) => {
    const extension = `.${fileName.split('.').pop()?.toLowerCase()}`;
    const fileType = FILE_CONFIG.descriptions[extension as keyof typeof FILE_CONFIG.descriptions] || '未知文件';
    return fileType;
  };

  if (sessionLoading) {
    return (
      <div className="max-w-4xl mx-auto flex items-center justify-center min-h-[400px]">
        <Spin size="large" tip="加载会话中..." />
      </div>
    );
  }

  if (!currentSession) {
    return (
      <div className="max-w-4xl mx-auto">
        <Alert
          message="请先创建或选择一个会话"
          description={
            <div>
              <p className="mb-2">您需要先创建一个新会话或从侧边栏选择一个已有的会话才能开始上传文档。</p>
              <Button type="primary" size="small" onClick={() => {
                const event = new Event('createNewSession');
                window.dispatchEvent(event);
              }}>
                创建新会话
              </Button>
            </div>
          }
          type="info"
          showIcon
          className="mb-6"
        />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* 页面标题 */}
      <Card>
        <Title level={2} className="!mb-2">
          PRD文档智能分析
        </Title>
        <Paragraph className="text-gray-600 !mb-4">
          上传产品需求文档，AI将自动分析并生成相应的测试用例。支持多种文档格式，智能提取关键信息。
        </Paragraph>
        <div className="flex items-center space-x-4">
          <Tag color="blue">当前会话: {currentSession.title}</Tag>
          <Text type="secondary">支持格式: {FILE_CONFIG.types.join('、')}</Text>
          <Text type="secondary">最大文件: {FILE_CONFIG.maxSize / 1024 / 1024}MB</Text>
        </div>
      </Card>

      {/* 文件上传区域 */}
      <Card>
        <Title level={4} className="!mb-4">
          1. 选择并上传文档
        </Title>

        {!uploadedFile ? (
          <Dragger {...uploadProps}>
            <p className="ant-upload-drag-icon">
              <InboxOutlined className="text-6xl text-blue-400" />
            </p>
            <p className="ant-upload-text text-lg font-medium">
              点击或拖拽文件到此区域
            </p>
            <p className="ant-upload-hint text-gray-500">
              支持 {FILE_CONFIG.types.join('、')} 格式，单个文件不超过 {FILE_CONFIG.maxSize / 1024 / 1024}MB
            </p>
          </Dragger>
        ) : (
          <div className="space-y-4">
            {/* 文件信息展示 */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <FileTextOutlined className="text-2xl text-blue-500" />
                <div>
                  <Text strong className="block">{uploadedFile.name}</Text>
                  <Text type="secondary" className="text-sm">
                    {getFileIcon(uploadedFile.name)} • {Math.round(uploadedFile.size / 1024)} KB
                  </Text>
                </div>
              </div>
              <Button
                type="text"
                icon={<DeleteOutlined />}
                onClick={handleRemoveFile}
                danger
              >
                移除
              </Button>
            </div>

            {/* 上传进度 */}
            {uploadProgress > 0 && uploadProgress < 100 && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <Text>上传进度</Text>
                  <Text>{Math.round(uploadProgress)}%</Text>
                </div>
                <Progress percent={uploadProgress} strokeColor="#1890ff" />
              </div>
            )}

            {/* 上传按钮 */}
            {!uploadedFile.uploaded && (
              <div className="flex justify-center">
                <Button
                  type="primary"
                  size="large"
                  onClick={handleUpload}
                  loading={uploadMutation.isPending}
                  icon={<FileTextOutlined />}
                >
                  开始上传
                </Button>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* 文档内容预览 */}
      {extractedContent && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <Title level={4} className="!mb-0">
              2. 文档内容预览
            </Title>
            <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={() => {
                Modal.info({
                  title: '完整文档内容',
                  width: 800,
                  content: (
                    <div className="max-h-96 overflow-y-auto">
                      <pre className="whitespace-pre-wrap text-sm">{extractedContent}</pre>
                    </div>
                  ),
                });
              }}
            >
              查看完整内容
            </Button>
          </div>
          <div className="bg-gray-50 p-4 rounded max-h-40 overflow-y-auto">
            <Text className="whitespace-pre-wrap text-sm">
              {extractedContent.slice(0, 500)}
              {extractedContent.length > 500 && '...'}
            </Text>
          </div>
        </Card>
      )}

      {/* AI分析 */}
      {uploadedFile?.uploaded && (
        <Card>
          <Title level={4} className="!mb-4">
            3. AI智能分析
          </Title>
          <div className="space-y-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <Text className="text-blue-800">
                <RobotOutlined className="mr-2" />
                AI将分析文档内容，自动生成相应的测试用例，包括功能测试、性能测试、安全测试等。
              </Text>
            </div>

            {isAnalyzing && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <Text>分析进度</Text>
                  <Text>{Math.round(analysisProgress)}%</Text>
                </div>
                <Progress percent={analysisProgress} strokeColor="#52c41a" />
              </div>
            )}

            <div className="flex justify-center space-x-4">
              <Button
                icon={<ReloadOutlined />}
                onClick={handleRemoveFile}
              >
                重新上传
              </Button>
              <Button
                type="primary"
                size="large"
                icon={<RobotOutlined />}
                onClick={handleAnalyze}
                loading={isAnalyzing}
                disabled={isAnalyzing}
              >
                {isAnalyzing ? 'AI分析中...' : '开始AI分析'}
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};

export default HomePage;