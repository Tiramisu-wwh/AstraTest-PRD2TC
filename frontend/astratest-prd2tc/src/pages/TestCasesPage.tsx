import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Modal,
  Form,
  Input,
  Select,
  Tag,
  Typography,
  Alert,
  Popconfirm,
  message,
  Empty,
  Spin,
  Tooltip,
  Row,
  Col,
  InputNumber,
  DatePicker,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  DownloadOutlined,
  SearchOutlined,
  ReloadOutlined,
  FileExcelOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import { useSession } from '../contexts/SessionContext';
import {
  useTestCases,
  useCreateTestCase,
  useUpdateTestCase,
  useDeleteTestCase,
} from '../hooks/useApi';
import { TestCase } from '../lib/api';
import type { ColumnsType } from 'antd/es/table';

const { Title, Text } = Typography;
const { TextArea } = Input;
const { RangePicker } = DatePicker;

// 测试用例列配置
const TEST_CASE_FIELDS = {
  priorities: ['高', '中', '低'],
  types: ['功能测试', '性能测试', '安全测试', '兼容性测试', '接口测试'],
  statuses: ['待执行', '执行中', '已通过', '已失败', '已阻塞'],
};

const TestCasesPage: React.FC = () => {
  const { currentSession, isLoading: sessionLoading } = useSession();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCase, setEditingCase] = useState<TestCase | null>(null);
  const [viewingCase, setViewingCase] = useState<TestCase | null>(null);
  const [form] = Form.useForm();

  // 搜索和筛选状态
  const [searchText, setSearchText] = useState('');
  const [filterPriority, setFilterPriority] = useState<string | undefined>();
  const [filterType, setFilterType] = useState<string | undefined>();
  const [filterStatus, setFilterStatus] = useState<string | undefined>();

  const { data: testCases = [], isLoading, refetch } = useTestCases(currentSession?.id);
  const createMutation = useCreateTestCase();
  const updateMutation = useUpdateTestCase();
  const deleteMutation = useDeleteTestCase();

  // 过滤测试用例
  const filteredTestCases = React.useMemo(() => {
    if (!Array.isArray(testCases)) return [];

    return testCases.filter((testCase) => {
      const matchesSearch = !searchText ||
        testCase.title.toLowerCase().includes(searchText.toLowerCase()) ||
        testCase.group_name?.toLowerCase().includes(searchText.toLowerCase()) ||
        testCase.maintainer?.toLowerCase().includes(searchText.toLowerCase()) ||
        testCase.precondition?.toLowerCase().includes(searchText.toLowerCase()) ||
        testCase.step_description?.toLowerCase().includes(searchText.toLowerCase()) ||
        testCase.expected_result?.toLowerCase().includes(searchText.toLowerCase());

      const matchesPriority = !filterPriority || testCase.case_level === filterPriority;
      const matchesType = !filterType || testCase.case_type === filterType;
      const matchesStatus = !filterStatus || testCase.status === filterStatus;

      return matchesSearch && matchesPriority && matchesType && matchesStatus;
    });
  }, [testCases, searchText, filterPriority, filterType, filterStatus]);

  const handleCreate = () => {
    setEditingCase(null);
    form.resetFields();
    setIsModalOpen(true);
  };

  const handleEdit = (record: TestCase) => {
    setEditingCase(record);
    form.setFieldsValue(record);
    setIsModalOpen(true);
  };

  const handleView = (record: TestCase) => {
    setViewingCase(record);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteMutation.mutateAsync(id);
      message.success('测试用例删除成功');
    } catch (error) {
      console.error('删除失败:', error);
      message.error('删除失败，请重试');
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      if (editingCase) {
        // 更新
        await updateMutation.mutateAsync({
          id: editingCase.id,
          ...values,
          session_id: currentSession?.id,
        });
        message.success('测试用例更新成功');
      } else {
        // 创建
        if (!currentSession) {
          message.error('请先选择一个会话');
          return;
        }
        await createMutation.mutateAsync({
          session_id: currentSession.id,
          ...values,
        });
        message.success('测试用例创建成功');
      }

      setIsModalOpen(false);
      form.resetFields();
    } catch (error) {
      console.error('提交失败:', error);
      message.error('操作失败，请检查输入');
    }
  };

  const exportToExcel = () => {
    if (!filteredTestCases || filteredTestCases.length === 0) {
      message.warning('没有数据可导出');
      return;
    }

    try {
      // 创建 CSV 数据
      const headers = [
        '测试用例标题',
        '测试组',
        '维护人',
        '前置条件',
        '测试步骤',
        '预期结果',
        '优先级',
        '类型',
        '状态',
        '创建时间',
      ];

      const csvContent = [
        headers.join(','),
        ...filteredTestCases.map(item => [
          `"${item.title || ''}"`,
          `"${item.group_name || ''}"`,
          `"${item.maintainer || ''}"`,
          `"${(item.precondition || '').replace(/"/g, '""')}"`,
          `"${(item.step_description || '').replace(/"/g, '""')}"`,
          `"${(item.expected_result || '').replace(/"/g, '""')}"`,
          `"${item.case_level || ''}"`,
          `"${item.case_type || ''}"`,
          `"${item.status || ''}"`,
          `"${new Date(item.created_at).toLocaleString('zh-CN')}"`,
        ].join(','))
      ].join('\n');

      // 下载文件
      const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `测试用例_${currentSession?.title}_${new Date().getTime()}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      message.success(`成功导出 ${filteredTestCases.length} 条测试用例`);
    } catch (error) {
      console.error('导出失败:', error);
      message.error('导出失败，请重试');
    }
  };

  const clearFilters = () => {
    setSearchText('');
    setFilterPriority(undefined);
    setFilterType(undefined);
    setFilterStatus(undefined);
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case '高':
        return 'red';
      case '中':
        return 'orange';
      case '低':
        return 'green';
      default:
        return 'default';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case '功能测试':
        return 'blue';
      case '性能测试':
        return 'purple';
      case '安全测试':
        return 'red';
      case '兼容性测试':
        return 'green';
      case '接口测试':
        return 'orange';
      default:
        return 'default';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case '已通过':
        return 'green';
      case '已失败':
        return 'red';
      case '执行中':
        return 'blue';
      case '已阻塞':
        return 'orange';
      case '待执行':
        return 'default';
      default:
        return 'default';
    }
  };

  const columns: ColumnsType<TestCase> = [
    {
      title: '测试用例标题',
      dataIndex: 'title',
      key: 'title',
      width: 250,
      ellipsis: {
        showTitle: false,
      },
      render: (title: string) => (
        <Tooltip placement="topLeft" title={title}>
          {title}
        </Tooltip>
      ),
    },
    {
      title: '测试组',
      dataIndex: 'group_name',
      key: 'group_name',
      width: 120,
      filters: Array.from(new Set(testCases.map((tc) => tc.group_name).filter(Boolean))).map((group) => ({
        text: group,
        value: group,
      })),
      onFilter: (value: any, record) => record.group_name === value,
    },
    {
      title: '维护人',
      dataIndex: 'maintainer',
      key: 'maintainer',
      width: 100,
    },
    {
      title: '优先级',
      dataIndex: 'case_level',
      key: 'case_level',
      width: 80,
      render: (level: string) => (
        <Tag color={getLevelColor(level)}>{level}</Tag>
      ),
      filters: TEST_CASE_FIELDS.priorities.map((priority) => ({
        text: priority,
        value: priority,
      })),
      onFilter: (value: any, record) => record.case_level === value,
    },
    {
      title: '类型',
      dataIndex: 'case_type',
      key: 'case_type',
      width: 100,
      render: (type: string) => (
        <Tag color={getTypeColor(type)}>{type}</Tag>
      ),
      filters: TEST_CASE_FIELDS.types.map((type) => ({
        text: type,
        value: type,
      })),
      onFilter: (value: any, record) => record.case_type === value,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: (status: string) => (
        <Tag color={getStatusColor(status)}>{status || '待执行'}</Tag>
      ),
      filters: TEST_CASE_FIELDS.statuses.map((status) => ({
        text: status,
        value: status,
      })),
      onFilter: (value: any, record) => (record.status || '待执行') === value,
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 120,
      render: (date: string) => new Date(date).toLocaleDateString('zh-CN'),
      sorter: (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="查看详情">
            <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={() => handleView(record)}
              size="small"
            />
          </Tooltip>
          <Tooltip title="编辑">
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
              size="small"
            />
          </Tooltip>
          <Popconfirm
            title="确认删除"
            description="确定要删除这个测试用例吗？"
            onConfirm={() => handleDelete(record.id)}
            okText="确认"
            cancelText="取消"
          >
            <Tooltip title="删除">
              <Button
                type="text"
                icon={<DeleteOutlined />}
                danger
                size="small"
                loading={deleteMutation.isPending}
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  if (sessionLoading) {
    return (
      <div className="max-w-6xl mx-auto flex items-center justify-center min-h-[400px]">
        <Spin size="large" tip="加载会话中..." />
      </div>
    );
  }

  if (!currentSession) {
    return (
      <div className="max-w-6xl mx-auto">
        <Alert
          message="请先创建或选择一个会话"
          description={
            <div>
              <p className="mb-2">您需要先创建一个新会话或从侧边栏选择一个已有的会话才能查看测试用例。</p>
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
    <div className="max-w-6xl mx-auto space-y-6">
      {/* 页面标题和统计 */}
      <Card>
        <div className="flex justify-between items-start">
          <div>
            <Title level={2} className="!mb-2">
              测试用例管理
            </Title>
            <Text className="text-gray-500">
              当前会话: {currentSession.title} • 共 {testCases.length} 条测试用例
            </Text>
          </div>
          <Space>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => refetch()}
              loading={isLoading}
            >
              刷新
            </Button>
            <Button
              icon={<FileExcelOutlined />}
              onClick={exportToExcel}
              disabled={!testCases || testCases.length === 0}
            >
              导出Excel
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleCreate}
            >
              新建测试用例
            </Button>
          </Space>
        </div>
      </Card>

      {/* 搜索和筛选 */}
      <Card>
        <Row gutter={16} align="middle">
          <Col span={8}>
            <Input
              placeholder="搜索测试用例标题、内容、维护人..."
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
            />
          </Col>
          <Col span={4}>
            <Select
              placeholder="优先级"
              allowClear
              value={filterPriority}
              onChange={setFilterPriority}
              options={TEST_CASE_FIELDS.priorities.map(priority => ({
                label: priority,
                value: priority,
              }))}
            />
          </Col>
          <Col span={4}>
            <Select
              placeholder="测试类型"
              allowClear
              value={filterType}
              onChange={setFilterType}
              options={TEST_CASE_FIELDS.types.map(type => ({
                label: type,
                value: type,
              }))}
            />
          </Col>
          <Col span={4}>
            <Select
              placeholder="执行状态"
              allowClear
              value={filterStatus}
              onChange={setFilterStatus}
              options={TEST_CASE_FIELDS.statuses.map(status => ({
                label: status,
                value: status,
              }))}
            />
          </Col>
          <Col span={4}>
            <Space>
              <Button onClick={clearFilters}>清除筛选</Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* 测试用例列表 */}
      <Card>
        <Table
          columns={columns}
          dataSource={filteredTestCases}
          rowKey="id"
          loading={isLoading}
          scroll={{ x: 1000 }}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => (
              <span>
                显示第 {range[0]} - {range[1]} 条，共 {total} 条
              </span>
            ),
          }}
          locale={{
            emptyText: (
              <Empty
                description="暂无测试用例"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              >
                {!searchText && !filterPriority && !filterType && !filterStatus && (
                  <Button type="primary" onClick={handleCreate}>
                    创建第一个测试用例
                  </Button>
                )}
              </Empty>
            ),
          }}
        />
      </Card>

      {/* 编辑模态框 */}
      <Modal
        title={editingCase ? '编辑测试用例' : '新建测试用例'}
        open={isModalOpen}
        onOk={handleSubmit}
        onCancel={() => {
          setIsModalOpen(false);
          form.resetFields();
        }}
        okText="确认"
        cancelText="取消"
        width={800}
        confirmLoading={createMutation.isPending || updateMutation.isPending}
      >
        <Form
          form={form}
          layout="vertical"
          className="mt-4"
        >
          <Form.Item
            name="title"
            label="测试用例标题"
            rules={[{ required: true, message: '请输入测试用例标题' }]}
          >
            <Input placeholder="请输入测试用例标题" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="group_name" label="测试组">
                <Input placeholder="请输入测试组名称" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="maintainer" label="维护人">
                <Input placeholder="请输入维护人" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="status" label="执行状态" initialValue="待执行">
                <Select>
                  {TEST_CASE_FIELDS.statuses.map(status => (
                    <Select.Option key={status} value={status}>{status}</Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="precondition" label="前置条件">
            <TextArea
              rows={2}
              placeholder="请输入测试的前置条件"
            />
          </Form.Item>

          <Form.Item name="step_description" label="测试步骤">
            <TextArea
              rows={4}
              placeholder="请输入详细的测试步骤，每个步骤一行"
            />
          </Form.Item>

          <Form.Item name="expected_result" label="预期结果">
            <TextArea
              rows={3}
              placeholder="请输入预期的测试结果"
            />
          </Form.Item>

          <Form.Item name="test_suggestions" label="AI测试建议">
            <TextArea
              rows={3}
              placeholder="请输入AI生成的测试建议，如测试数据准备、注意事项等"
            />
          </Form.Item>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                name="case_level"
                label="优先级"
                initialValue="中"
              >
                <Select>
                  {TEST_CASE_FIELDS.priorities.map(priority => (
                    <Select.Option key={priority} value={priority}>{priority}</Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="case_type"
                label="测试类型"
                initialValue="功能测试"
              >
                <Select>
                  {TEST_CASE_FIELDS.types.map(type => (
                    <Select.Option key={type} value={type}>{type}</Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="execution_time"
                label="预估执行时间(分钟)"
                initialValue={30}
              >
                <InputNumber
                  min={1}
                  max={480}
                  style={{ width: '100%' }}
                  placeholder="分钟"
                />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      {/* 查看详情模态框 */}
      <Modal
        title="测试用例详情"
        open={!!viewingCase}
        onCancel={() => setViewingCase(null)}
        footer={[
          <Button key="close" onClick={() => setViewingCase(null)}>关闭</Button>,
          viewingCase && (
            <Button key="edit" type="primary" onClick={() => {
              setViewingCase(null);
              handleEdit(viewingCase);
            }}>
              编辑
            </Button>
          ),
        ]}
        width={800}
      >
        {viewingCase && (
          <div className="space-y-4">
            <Row gutter={16}>
              <Col span={12}>
                <Text strong>测试用例标题</Text>
                <p>{viewingCase.title}</p>
              </Col>
              <Col span={12}>
                <Text strong>测试组</Text>
                <p>{viewingCase.group_name || '-'}</p>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={8}>
                <Text strong>维护人</Text>
                <p>{viewingCase.maintainer || '-'}</p>
              </Col>
              <Col span={8}>
                <Text strong>优先级</Text>
                <p><Tag color={getLevelColor(viewingCase.case_level)}>{viewingCase.case_level}</Tag></p>
              </Col>
              <Col span={8}>
                <Text strong>测试类型</Text>
                <p><Tag color={getTypeColor(viewingCase.case_type)}>{viewingCase.case_type}</Tag></p>
              </Col>
            </Row>
            <div>
              <Text strong>前置条件</Text>
              <pre className="whitespace-pre-wrap bg-gray-50 p-3 rounded">{viewingCase.precondition || '-'}</pre>
            </div>
            <div>
              <Text strong>测试步骤</Text>
              <pre className="whitespace-pre-wrap bg-gray-50 p-3 rounded">{viewingCase.step_description || '-'}</pre>
            </div>
            <div>
              <Text strong>预期结果</Text>
              <pre className="whitespace-pre-wrap bg-gray-50 p-3 rounded">{viewingCase.expected_result || '-'}</pre>
            </div>
            {viewingCase.test_suggestions && (
              <div>
                <Text strong>AI测试建议</Text>
                <Alert
                  message="AI生成的测试建议"
                  description={
                    <pre className="whitespace-pre-wrap">{viewingCase.test_suggestions}</pre>
                  }
                  type="info"
                  className="mt-2"
                />
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default TestCasesPage;