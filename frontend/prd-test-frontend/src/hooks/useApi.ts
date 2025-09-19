import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, TestCase, ChatSession, AIConfiguration } from '../lib/api';
import { message } from 'antd';

// 会话相关
export const useSessions = () => {
  return useQuery({
    queryKey: ['sessions'],
    queryFn: api.getSessions,
  });
};

export const useCreateSession = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: api.createSession,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      message.success('会话创建成功');
    },
    onError: () => {
      message.error('会话创建失败');
    },
  });
};

// 测试用例相关
export const useTestCases = (sessionId: string | undefined) => {
  return useQuery({
    queryKey: ['testCases', sessionId],
    queryFn: () => sessionId ? api.getTestCases(sessionId) : Promise.resolve([]),
    enabled: !!sessionId,
  });
};

export const useCreateTestCase = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: api.createTestCase,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['testCases', variables.session_id] });
      message.success('测试用例创建成功');
    },
    onError: () => {
      message.error('测试用例创建失败');
    },
  });
};

export const useUpdateTestCase = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Partial<TestCase>) => 
      api.updateTestCase(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['testCases'] });
      message.success('测试用例更新成功');
    },
    onError: () => {
      message.error('测试用例更新失败');
    },
  });
};

export const useDeleteTestCase = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: api.deleteTestCase,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['testCases'] });
      message.success('测试用例删除成功');
    },
    onError: () => {
      message.error('测试用例删除失败');
    },
  });
};

// 文件上传和AI分析
export const useUploadFile = () => {
  return useMutation({
    mutationFn: ({ file, sessionId }: { file: File; sessionId: string }) => 
      api.uploadFile(file, sessionId),
    onSuccess: () => {
      message.success('文件上传成功');
    },
    onError: () => {
      message.error('文件上传失败');
    },
  });
};

export const useAnalyzeDocument = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ fileId, sessionId }: { fileId: string; sessionId: string }) => 
      api.analyzeDocument(fileId, sessionId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['testCases', variables.sessionId] });
      message.success('AI分析完成');
    },
    onError: () => {
      message.error('AI分析失败');
    },
  });
};

// AI配置相关
export const useAIConfigs = () => {
  return useQuery({
    queryKey: ['aiConfigs'],
    queryFn: api.getAIConfigs,
  });
};

export const useCreateAIConfig = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: api.createAIConfig,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aiConfigs'] });
      message.success('AI配置创建成功');
    },
    onError: () => {
      message.error('AI配置创建失败');
    },
  });
};