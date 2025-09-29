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
import * as XLSX from 'xlsx';
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
      // 创建工作簿
      const workbook = XLSX.utils.book_new();

      // 准备数据，严格按照Excel模板格式
      const exportData = filteredTestCases.map((item, index) => ({
        '标题*': item.title || '',
        '所属分组': item.group_name || '',
        '维护人': item.maintainer || '',
        '前置条件': item.precondition || '',
        '步骤描述': item.step_description || '',
        '预期结果': item.expected_result || '',
        '用例等级': item.case_level || '中',
        '用例类型': item.case_type || '功能测试',
      }));

      // 添加表头说明行（第一行）
      const headerNotes = [
        {
          '标题*': '填写规则和示例内容勿删',
          '所属分组': '所属分组、维护人、用例类型、用例等级必须与已有信息相匹配',
          '维护人': '填写错误将导致无法导入',
          '前置条件': '',
          '步骤描述': '',
          '预期结果': '',
          '用例等级': '',
          '用例类型': '',
        }
      ];

      // 添加列标题行（第二行）
      const headers = [
        {
          '标题*': '标题*',
          '所属分组': '所属分组',
          '维护人': '维护人',
          '前置条件': '前置条件',
          '步骤描述': '步骤描述',
          '预期结果': '预期结果',
          '用例等级': '用例等级',
          '用例类型': '用例类型',
        }
      ];

      // 添加示例数据行（第三行）
      const exampleData = [
        {
          '标题*': '（示例勿删）待办列表测试',
          '所属分组': 'Web端测试用例|首页|我的待办',
          '维护人': '王XX',
          '前置条件': '我的待办中存在待处理的任务',
          '步骤描述': '【1】显示当前未处理的任务\n【2】可以正常进入任务详情',
          '预期结果': '【1】显示当前未处理的任务\n【2】可以正常进入任务详情',
          '用例等级': '中',
          '用例类型': '功能测试',
        }
      ];

      // 合并所有数据：说明行 + 标题行 + 示例行 + 实际数据
      const allData = [...headerNotes, ...headers, ...exampleData, ...exportData];

      // 创建工作表
      const worksheet = XLSX.utils.json_to_sheet(allData, { skipHeader: true });

      // 设置列宽
      const colWidths = [
        { wch: 30 }, // 标题
        { wch: 25 }, // 所属分组
        { wch: 15 }, // 维护人
        { wch: 30 }, // 前置条件
        { wch: 40 }, // 步骤描述
        { wch: 40 }, // 预期结果
        { wch: 10 }, // 用例等级
        { wch: 12 }, // 用例类型
      ];
      worksheet['!cols'] = colWidths;

      // 设置行高 - 第一行说明行加高
      const rowHeights = [
        { hpt: 20 }, // 说明行
        { hpt: 16 }, // 标题行
        { hpt: 16 }, // 示例行
        ...exportData.map(() => ({ hpt: 14 })), // 数据行
      ];
      worksheet['!rows'] = rowHeights;

      // 添加工作表到工作簿
      XLSX.utils.book_append_sheet(workbook, worksheet, '测试用例');

      // 生成Excel文件
      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

      // 下载文件
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `测试用例_${currentSession?.title}_${new Date().getTime()}.xlsx`);
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
      title: '标题*',
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
      title: '所属分组',
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
      title: '用例等级',
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
      title: '用例类型',
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
              placeholder="搜索标题*、所属分组、维护人、前置条件、步骤描述、预期结果..."
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
              <Form.Item name="group_name" label="所属分组">
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

          <Form.Item name="step_description" label="步骤描述">
            <TextArea
              rows={4}
              placeholder="请输入详细的测试步骤，使用【1】、【2】等编号格式，每个步骤一行"
            />
          </Form.Item>

          <Form.Item name="expected_result" label="预期结果">
            <TextArea
              rows={3}
              placeholder="请输入预期的测试结果，使用【1】、【2】等编号格式，与步骤描述对应"
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
                label="用例等级"
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
                label="用例类型"
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
                <Text strong>所属分组</Text>
                <p>{viewingCase.group_name || '-'}</p>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={8}>
                <Text strong>维护人</Text>
                <p>{viewingCase.maintainer || '-'}</p>
              </Col>
              <Col span={8}>
                <Text strong>用例等级</Text>
                <p><Tag color={getLevelColor(viewingCase.case_level)}>{viewingCase.case_level}</Tag></p>
              </Col>
              <Col span={8}>
                <Text strong>用例类型</Text>
                <p><Tag color={getTypeColor(viewingCase.case_type)}>{viewingCase.case_type}</Tag></p>
              </Col>
            </Row>
            <div>
              <Text strong>前置条件</Text>
              <pre className="whitespace-pre-wrap bg-gray-50 p-3 rounded">{viewingCase.precondition || '-'}</pre>
            </div>
            <div>
              <Text strong>步骤描述</Text>
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