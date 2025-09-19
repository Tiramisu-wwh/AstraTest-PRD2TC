import React, { useState } from 'react';
import {
  Card,
  Form,
  Input,
  Button,
  Space,
  Typography,
  Alert,
  Switch,
  Divider,
  List,
  Tag,
  Modal,
  message,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { useAIConfigs, useCreateAIConfig } from '../hooks/useApi';
import { AIConfiguration } from '../lib/api';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

const SettingsPage: React.FC = () => {
  const [form] = Form.useForm();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<AIConfiguration | null>(null);

  const { data: configs, isLoading } = useAIConfigs();
  const createMutation = useCreateAIConfig();

  const handleCreate = () => {
    setEditingConfig(null);
    form.resetFields();
    // 设置默认值
    form.setFieldsValue({
      provider: '阿里云千问',
      api_endpoint: 'https://chat.r2ai.com.cn/v1',
      model_name: 'qwen3',
      is_active: true,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      
      await createMutation.mutateAsync({
        user_id: 'default',
        ...values,
      });
      
      setIsModalOpen(false);
      form.resetFields();
    } catch (error) {
      console.error('提交失败:', error);
    }
  };

  const testConnection = async (config: AIConfiguration) => {
    // 这里可以实现测试连接的逻辑
    message.info('测试连接功能暂未实现');
  };

  return (
    <div className="max-w-4xl mx-auto">
      <Card className="mb-6">
        <Title level={2} className="!mb-4">
          AI配置管理
        </Title>
        <Paragraph className="text-gray-600 mb-6">
          配置AI服务提供商的API信息，用于文档分析和测试用例生成。
          系统已预置阿里云千问的配置，您也可以添加其他AI服务。
        </Paragraph>

        <Alert
          message="注意事项"
          description="请确保API密钥的安全性，不要在公共环境下暴露您的API密钥。"
          type="warning"
          showIcon
          className="mb-6"
        />
      </Card>

      <Card
        title="AI配置列表"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            添加配置
          </Button>
        }
      >
        {configs && configs.length > 0 ? (
          <List
            dataSource={configs}
            renderItem={(config) => (
              <List.Item
                actions={[
                  <Button
                    type="text"
                    icon={<EditOutlined />}
                    onClick={() => testConnection(config)}
                  >
                    测试连接
                  </Button>,
                ]}
              >
                <List.Item.Meta
                  avatar={
                    config.is_active ? (
                      <CheckCircleOutlined className="text-green-500 text-lg" />
                    ) : (
                      <ExclamationCircleOutlined className="text-gray-400 text-lg" />
                    )
                  }
                  title={
                    <div className="flex items-center gap-2">
                      <span>{config.provider}</span>
                      {config.is_active && (
                        <Tag color="green" size="small">
                          当前使用
                        </Tag>
                      )}
                    </div>
                  }
                  description={
                    <div className="space-y-1">
                      <div>
                        <Text strong>模型:</Text> {config.model_name}
                      </div>
                      <div>
                        <Text strong>API端点:</Text> {config.api_endpoint}
                      </div>
                      <div>
                        <Text strong>API密钥:</Text> {config.api_key}
                      </div>
                      <div className="text-xs text-gray-500">
                        创建时间: {new Date(config.created_at).toLocaleString()}
                      </div>
                    </div>
                  }
                />
              </List.Item>
            )}
          />
        ) : (
          <div className="text-center py-8">
            <ExclamationCircleOutlined className="text-4xl text-gray-400 mb-4" />
            <Text className="text-gray-500">
              暂无AI配置，请点击上方按钮添加配置
            </Text>
          </div>
        )}
      </Card>

      <Modal
        title="添加AI配置"
        open={isModalOpen}
        onOk={handleSubmit}
        onCancel={() => {
          setIsModalOpen(false);
          form.resetFields();
        }}
        okText="保存"
        cancelText="取消"
        width={600}
        confirmLoading={createMutation.isPending}
      >
        <Form
          form={form}
          layout="vertical"
          className="mt-4"
        >
          <Form.Item
            name="provider"
            label="服务提供商"
            rules={[{ required: true, message: '请输入服务提供商名称' }]}
          >
            <Input placeholder="例如：阿里云千问" />
          </Form.Item>

          <Form.Item
            name="api_endpoint"
            label="API端点"
            rules={[
              { required: true, message: '请输入API端点URL' },
              { type: 'url', message: '请输入正确的URL格式' },
            ]}
          >
            <Input placeholder="https://api.example.com/v1" />
          </Form.Item>

          <Form.Item
            name="model_name"
            label="模型名称"
            rules={[{ required: true, message: '请输入模型名称' }]}
          >
            <Input placeholder="例如：qwen3" />
          </Form.Item>

          <Form.Item
            name="api_key"
            label="API密钥"
            rules={[{ required: true, message: '请输入API密钥' }]}
          >
            <Input.Password placeholder="sk-xxxxxxxxxxxxxxx" />
          </Form.Item>

          <Form.Item
            name="is_active"
            label="设为默认配置"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
        </Form>

        <Divider />
        
        <Alert
          message="常用AI服务配置参考"
          description={
            <div className="space-y-2 mt-2">
              <div>
                <Text strong>阿里云千问:</Text>
                <br />
                API端点: https://chat.r2ai.com.cn/v1
                <br />
                模型: qwen3
              </div>
              <div>
                <Text strong>OpenAI:</Text>
                <br />
                API端点: https://api.openai.com/v1
                <br />
                模型: gpt-3.5-turbo, gpt-4
              </div>
            </div>
          }
          type="info"
          showIcon
        />
      </Modal>
    </div>
  );
};

export default SettingsPage;