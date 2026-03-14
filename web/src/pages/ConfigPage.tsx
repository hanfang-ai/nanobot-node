import React, { useState, useEffect } from 'react';
import { Card, Form, Input, Select, Button, message, Space, Divider, Alert } from 'antd';
import { SaveOutlined, TestOutlined } from '@ant-design/icons';
import axios from 'axios';

const { Option } = Select;
const { TextArea } = Input;

interface Config {
  model: {
    provider: string;
    api_key: string;
    model: string;
    base_url: string;
  };
  restrict_to_workspace: boolean;
  max_iterations: number;
  workspace: string;
}

const ConfigPage: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [testLoading, setTestLoading] = useState(false);

  useEffect(() => {
    // 加载当前配置
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const res = await axios.get('/api/config');
      form.setFieldsValue(res.data);
    } catch (error) {
      message.error('加载配置失败');
    }
  };

  const onFinish = async (values: Config) => {
    setLoading(true);
    try {
      await axios.post('/api/config', values);
      message.success('配置保存成功，重启后生效');
    } catch (error) {
      message.error('保存配置失败');
    } finally {
      setLoading(false);
    }
  };

  const testConnection = async () => {
    const values = form.getFieldsValue();
    setTestLoading(true);
    try {
      await axios.post('/api/config/test', values);
      message.success('连接测试成功！');
    } catch (error: any) {
      message.error(`连接测试失败：${error.response?.data?.message || error.message}`);
    } finally {
      setTestLoading(false);
    }
  };

  const presetProvider = (provider: string) => {
    if (provider === 'volcengine') {
      form.setFieldsValue({
        'model.base_url': 'https://ark.cn-beijing.volces.com/api/coding/v3',
        'model.model': 'ark-code-latest',
      });
    } else if (provider === 'openai') {
      form.setFieldsValue({
        'model.base_url': 'https://api.openai.com/v1',
        'model.model': 'gpt-4o',
      });
    }
  };

  return (
    <div className="config-page">
      <Card title="基础配置" className="config-card">
        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
          initialValues={{
            restrict_to_workspace: true,
            max_iterations: 40,
            workspace: '~/.nanobot/workspace',
          }}
        >
          <Divider>模型配置</Divider>

          <Form.Item
            label="模型提供商"
            name={['model', 'provider']}
            rules={[{ required: true, message: '请选择模型提供商' }]}
          >
            <Select onChange={presetProvider}>
              <Option value="volcengine">火山引擎 (Doubao/Coding Plan)</Option>
              <Option value="openai">OpenAI</Option>
              <Option value="anthropic">Anthropic</Option>
            </Select>
          </Form.Item>

          <Form.Item
            label="API Key"
            name={['model', 'api_key']}
            rules={[{ required: true, message: '请输入API Key' }]}
          >
            <Input.Password placeholder="输入API Key" />
          </Form.Item>

          <Form.Item
            label="模型名称"
            name={['model', 'model']}
            rules={[{ required: true, message: '请输入模型名称' }]}
          >
            <Input placeholder="如：ark-code-latest、gpt-4o" />
          </Form.Item>

          <Form.Item
            label="API Base URL"
            name={['model', 'base_url']}
            rules={[{ required: true, message: '请输入API Base URL' }]}
          >
            <Input placeholder="如：https://ark.cn-beijing.volces.com/api/coding/v3" />
          </Form.Item>

          <Space>
            <Button 
              type="primary" 
              icon={<TestOutlined />} 
              onClick={testConnection}
              loading={testLoading}
            >
              测试连接
            </Button>
          </Space>

          <Divider>系统配置</Divider>

          <Form.Item
            label="工作目录"
            name="workspace"
            rules={[{ required: true, message: '请输入工作目录' }]}
          >
            <Input placeholder="工作目录路径" />
          </Form.Item>

          <Form.Item
            label="最大工具调用次数"
            name="max_iterations"
            rules={[{ required: true, message: '请输入最大迭代次数' }]}
          >
            <Input.Number min={1} max={100} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            label="限制文件访问到工作目录"
            name="restrict_to_workspace"
            valuePropName="checked"
          >
            <Select>
              <Option value={true}>是</Option>
              <Option value={false}>否</Option>
            </Select>
          </Form.Item>

          <Form.Item>
            <Space>
              <Button 
                type="primary" 
                htmlType="submit" 
                icon={<SaveOutlined />}
                loading={loading}
              >
                保存配置
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>

      <Alert
        message="Coding Plan配置提示"
        description="如果使用火山引擎Coding Plan套餐，选择提供商为火山引擎后会自动填充正确的Base URL和模型名称，只需输入API Key即可。"
        type="info"
        showIcon
      />
    </div>
  );
};

export default ConfigPage;
