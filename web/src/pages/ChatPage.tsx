import React, { useState, useRef, useEffect } from 'react';
import { Input, Button, List, Avatar, Spin, Empty } from 'antd';
import { SendOutlined, UserOutlined, RobotOutlined } from '@ant-design/icons';
import axios from 'axios';
import dayjs from 'dayjs';

const { TextArea } = Input;

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  loading?: boolean;
}

const ChatPage: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: dayjs().format('HH:mm:ss'),
    };

    const assistantMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: '',
      timestamp: dayjs().format('HH:mm:ss'),
      loading: true,
    };

    setMessages(prev => [...prev, userMessage, assistantMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await axios.post('/api/chat', {
        message: input.trim(),
      });

      setMessages(prev => 
        prev.map(msg => 
          msg.id === assistantMessage.id 
            ? { ...msg, content: response.data.content, loading: false }
            : msg
        )
      );
    } catch (error: any) {
      setMessages(prev => 
        prev.map(msg => 
          msg.id === assistantMessage.id 
            ? { 
                ...msg, 
                content: `抱歉，发生错误：${error.response?.data?.message || error.message}`, 
                loading: false 
              }
            : msg
        )
      );
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="chat-container">
      <div className="chat-messages">
        {messages.length === 0 ? (
          <div style={{ 
            height: '100%', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center' 
          }}>
            <Empty 
              description="开始和 nanobot 聊天吧！" 
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          </div>
        ) : (
          <List
            dataSource={messages}
            renderItem={msg => (
              <List.Item key={msg.id} className={`message-item ${msg.role}`}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', maxWidth: '70%' }}>
                  {msg.role === 'assistant' && (
                    <Avatar size={36} icon={<RobotOutlined />} style={{ backgroundColor: '#1890ff' }} />
                  )}
                  <div>
                    <div className="message-bubble">
                      {msg.loading ? (
                        <Spin size="small" />
                      ) : (
                        <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
                      )}
                    </div>
                    <div className="message-time">{msg.timestamp}</div>
                  </div>
                  {msg.role === 'user' && (
                    <Avatar size={36} icon={<UserOutlined />} style={{ backgroundColor: '#52c41a' }} />
                  )}
                </div>
              </List.Item>
            )}
          />
        )}
        <div ref={messagesEndRef} />
      </div>
      
      <div className="chat-input-area">
        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
          <TextArea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入消息，按Enter发送，Shift+Enter换行"
            autoSize={{ minRows: 2, maxRows: 8 }}
            disabled={loading}
          />
          <Button
            type="primary"
            icon={<SendOutlined />}
            onClick={handleSend}
            loading={loading}
            size="large"
          >
            发送
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ChatPage;
