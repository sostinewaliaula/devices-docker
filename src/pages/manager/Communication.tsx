import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContextNew';
import { useNotifications } from '../../contexts/NotificationContext';
import { 
  MessageSquareIcon, 
  SendIcon, 
  SearchIcon, 
  FilterIcon, 
  BellIcon,
  UserIcon,
  CalendarIcon,
  AlertCircleIcon,
  CheckCircleIcon,
  ClockIcon,
  PlusIcon
} from 'lucide-react';
import { userService, notificationService, managerService } from '../../services/apiDatabase';
import { User, NotificationRecord } from '../../lib/supabase';

interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  subject: string;
  content: string;
  created_at: string;
  read_at?: string;
  priority: 'Low' | 'Medium' | 'High';
  type: 'message' | 'announcement' | 'alert';
}

const Communication: React.FC = () => {
  const { user } = useAuth();
  const { addToast } = useNotifications();
  const [teamMembers, setTeamMembers] = useState<User[]>([]);
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    teamMembersCount: 0,
    unreadNotificationsCount: 0,
    messagesSentCount: 0,
    totalNotificationsCount: 0
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);
  const [newMessage, setNewMessage] = useState({
    receiver_id: '',
    subject: '',
    content: '',
    priority: 'Medium' as 'Low' | 'Medium' | 'High',
    type: 'message' as 'message' | 'announcement' | 'alert'
  });
  const [sendingMessage, setSendingMessage] = useState(false);
  const [sendingAnnouncement, setSendingAnnouncement] = useState(false);

  // Function to get messages sent by the manager
  const getManagerMessages = async (managerId: string): Promise<Message[]> => {
    try {
      // Get real messages from notifications that are messages sent by this manager
      const allNotifications = await notificationService.getForUser(managerId);
      
      // Filter for messages and announcements sent by this manager
      const messageNotifications = allNotifications.filter(notification => 
        notification.type === 'info' && 
        (notification.title?.includes('Message from') || notification.title?.includes('Announcement from'))
      );

      // Convert notifications to message format
      const messages: Message[] = messageNotifications.map((notification) => {
        const isAnnouncement = notification.title?.includes('Announcement');
        const priority = (notification as any).priority || 'Medium';
        
        return {
          id: notification.id,
          sender_id: managerId,
          receiver_id: isAnnouncement ? 'all' : 'unknown', // For announcements, receiver is all team members
          subject: notification.title?.replace('Message from ' + user?.name + ': ', '').replace('Announcement from ' + user?.name + ': ', '') || 'No Subject',
          content: notification.message || 'No content',
          created_at: notification.created_at,
          priority: priority as 'Low' | 'Medium' | 'High',
          type: isAnnouncement ? 'announcement' : 'message'
        };
      });

      // Sort by creation date (newest first) and limit to 5
      return messages
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 5);
    } catch (error) {
      console.error('Error fetching manager messages:', error);
      return [];
    }
  };

  useEffect(() => {
    if (!user?.department_id) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        const [fTeamMembers, fNotifications, fMessages] = await Promise.all([
          userService.getByDepartment(user.department_id!),
          notificationService.getForUser(user.id!),
          // Get messages sent by this manager
          getManagerMessages(user.id!)
        ]);

        setTeamMembers(fTeamMembers);
        setNotifications(fNotifications);
        setMessages(fMessages);

        // Calculate statistics
        const unreadCount = fNotifications.filter(n => !(n as any).read_at).length;
        const messagesSentCount = fMessages.length;

        setStats({
          teamMembersCount: fTeamMembers.length,
          unreadNotificationsCount: unreadCount,
          messagesSentCount: messagesSentCount,
          totalNotificationsCount: fNotifications.length
        });
      } catch (error) {
        console.error('Error fetching communication data:', error);
        addToast({
          title: 'Error',
          message: 'Failed to load communication data',
          type: 'error',
          duration: 5000
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user?.department_id, user?.id]);

  const filteredNotifications = notifications.filter(notification => {
    const matchesSearch = notification.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         notification.message.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || notification.type === filterType;
    return matchesSearch && matchesType;
  });

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'High':
        return 'bg-red-100 text-red-800';
      case 'Medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'Low':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'message':
        return 'bg-blue-100 text-blue-800';
      case 'announcement':
        return 'bg-purple-100 text-purple-800';
      case 'alert':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'message':
        return <MessageSquareIcon className="w-4 h-4" />;
      case 'announcement':
        return <BellIcon className="w-4 h-4" />;
      case 'alert':
        return <AlertCircleIcon className="w-4 h-4" />;
      default:
        return <BellIcon className="w-4 h-4" />;
    }
  };

  const getUserName = (userId: string | null) => {
    if (!userId) return 'Unknown';
    if (userId === 'all') return 'All Team Members';
    const u = teamMembers.find(x => x.id === userId);
    return u ? u.name : 'Unknown';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleSendMessage = async () => {
    if (!newMessage.receiver_id || !newMessage.subject.trim() || !newMessage.content.trim()) {
      addToast({
        title: 'Validation Error',
        message: 'Please fill in all required fields',
        type: 'error',
        duration: 3000
      });
      return;
    }

    setSendingMessage(true);
    try {
      // Send message via API
      await managerService.sendMessage(
        newMessage.receiver_id,
        newMessage.subject.trim(),
        newMessage.content.trim(),
        newMessage.priority.charAt(0).toUpperCase() + newMessage.priority.slice(1).toLowerCase()
      );

      // Add to local messages for display
      const message: Message = {
        id: Date.now().toString(),
        sender_id: user?.id || '',
        receiver_id: newMessage.receiver_id,
        subject: newMessage.subject.trim(),
        content: newMessage.content.trim(),
        created_at: new Date().toISOString(),
        priority: newMessage.priority,
        type: newMessage.type
      };

      setMessages(prev => [message, ...prev]);
      setShowMessageModal(false);
      setNewMessage({
        receiver_id: '',
        subject: '',
        content: '',
        priority: 'Medium',
        type: 'message'
      });

      // Update stats and refresh messages
      setStats(prev => ({
        ...prev,
        messagesSentCount: prev.messagesSentCount + 1
      }));

      // Refresh messages to show the new one
      if (user?.id) {
        const updatedMessages = await getManagerMessages(user.id);
        setMessages(updatedMessages);
      }

      addToast({
        title: 'Message Sent',
        message: 'Your message has been sent successfully',
        type: 'success',
        duration: 3000
      });
    } catch (error) {
      console.error('Error sending message:', error);
      addToast({
        title: 'Error',
        message: 'Failed to send message',
        type: 'error',
        duration: 5000
      });
    } finally {
      setSendingMessage(false);
    }
  };

  const handleSendAnnouncement = async () => {
    if (!newMessage.subject.trim() || !newMessage.content.trim()) {
      addToast({
        title: 'Validation Error',
        message: 'Please fill in all required fields',
        type: 'error',
        duration: 3000
      });
      return;
    }

    setSendingAnnouncement(true);
    try {
      // Send announcement via API
      await managerService.sendAnnouncement(
        newMessage.subject.trim(),
        newMessage.content.trim(),
        newMessage.priority.charAt(0).toUpperCase() + newMessage.priority.slice(1).toLowerCase()
      );

      // Add to local messages for display
      const announcementMessages: Message[] = teamMembers.map(member => ({
        id: `${Date.now()}-${member.id}`,
        sender_id: user?.id || '',
        receiver_id: member.id,
        subject: newMessage.subject.trim(),
        content: newMessage.content.trim(),
        created_at: new Date().toISOString(),
        priority: newMessage.priority,
        type: 'announcement'
      }));

      setMessages(prev => [...announcementMessages, ...prev]);
      setShowAnnouncementModal(false);
      setNewMessage({
        receiver_id: '',
        subject: '',
        content: '',
        priority: 'Medium',
        type: 'message'
      });

      // Update stats and refresh messages
      setStats(prev => ({
        ...prev,
        messagesSentCount: prev.messagesSentCount + teamMembers.length
      }));

      // Refresh messages to show the new announcement
      if (user?.id) {
        const updatedMessages = await getManagerMessages(user.id);
        setMessages(updatedMessages);
      }

      addToast({
        title: 'Announcement Sent',
        message: `Announcement sent to ${teamMembers.length} team members`,
        type: 'success',
        duration: 3000
      });
    } catch (error) {
      console.error('Error sending announcement:', error);
      addToast({
        title: 'Error',
        message: 'Failed to send announcement',
        type: 'error',
        duration: 5000
      });
    } finally {
      setSendingAnnouncement(false);
    }
  };

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await notificationService.markAsRead(notificationId);
      setNotifications(prev => 
        prev.map(notif => 
          notif.id === notificationId 
            ? { ...notif, read_at: new Date().toISOString() }
            : notif
        )
      );

      // Update stats
      setStats(prev => ({
        ...prev,
        unreadNotificationsCount: Math.max(0, prev.unreadNotificationsCount - 1)
      }));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const unreadCount = stats.unreadNotificationsCount;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center">
          <div className="w-12 h-12 border-t-2 border-b-2 border-primary rounded-full animate-spin"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading communication...</p>
        </div>
      </div>
    );
  }

  if (!user?.department_id) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <MessageSquareIcon className="w-16 h-16 mx-auto text-gray-400 dark:text-gray-500 mb-4" />
          <h2 className="text-xl font-semibold text-gray-600 dark:text-gray-300 mb-2">No Department Assigned</h2>
          <p className="text-gray-500 dark:text-gray-400">Please contact your administrator to assign you to a department.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-card">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-primary">Team Communication</h1>
            <p className="mt-2 text-gray-700 dark:text-gray-300">
              Communicate with your team members and manage notifications
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setShowAnnouncementModal(true)}
              className="button-primary flex items-center"
            >
              <BellIcon className="w-5 h-5 mr-2" />
              Send Announcement
            </button>
            <button
              onClick={() => setShowMessageModal(true)}
              className="button-primary flex items-center"
            >
              <PlusIcon className="w-5 h-5 mr-2" />
              New Message
            </button>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-card">
          <div className="flex items-center">
            <div className="p-3 mr-4 bg-blue-100 rounded-full">
              <MessageSquareIcon className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Team Members</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.teamMembersCount}</p>
            </div>
          </div>
        </div>
        <div className="p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-card">
          <div className="flex items-center">
            <div className="p-3 mr-4 bg-yellow-100 rounded-full">
              <BellIcon className="w-6 h-6 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Unread Notifications</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{unreadCount}</p>
            </div>
          </div>
        </div>
        <div className="p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-card">
          <div className="flex items-center">
            <div className="p-3 mr-4 bg-green-100 rounded-full">
              <MessageSquareIcon className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Messages Sent</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.messagesSentCount}</p>
            </div>
          </div>
        </div>
        <div className="p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-card">
          <div className="flex items-center">
            <div className="p-3 mr-4 bg-purple-100 rounded-full">
              <BellIcon className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Total Notifications</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalNotificationsCount}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-card">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search notifications..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
            />
          </div>
          <div className="flex items-center gap-2">
            <FilterIcon className="w-5 h-5 text-gray-400" />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              <option value="all">All Types</option>
              <option value="info">Info</option>
              <option value="success">Success</option>
              <option value="warning">Warning</option>
              <option value="error">Error</option>
            </select>
          </div>
        </div>
      </div>

      {/* Notifications */}
      <div className="p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-card">
        <h2 className="text-xl font-bold text-primary mb-6">Notifications ({filteredNotifications.length})</h2>
        
        {filteredNotifications.length === 0 ? (
          <div className="text-center py-12">
            <BellIcon className="w-16 h-16 mx-auto text-gray-400 dark:text-gray-500 mb-4" />
            <h3 className="text-lg font-semibold text-gray-600 dark:text-gray-300 mb-2">No notifications found</h3>
            <p className="text-gray-500 dark:text-gray-400">Try adjusting your search or filter criteria.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredNotifications.map((notification) => (
              <div 
                key={notification.id} 
                className={`p-4 border rounded-xl hover:shadow-lg transition-shadow cursor-pointer ${
                  (notification as any).read_at 
                    ? 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800' 
                    : 'border-primary bg-primary/5'
                }`}
                onClick={() => handleMarkAsRead(notification.id)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`p-2 rounded-full ${
                        notification.type === 'error' ? 'bg-red-100' :
                        notification.type === 'warning' ? 'bg-yellow-100' :
                        notification.type === 'success' ? 'bg-green-100' :
                        'bg-blue-100'
                      }`}>
                        {getTypeIcon(notification.type)}
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        {notification.title}
                      </h3>
                      {!(notification as any).read_at && (
                        <div className="w-2 h-2 bg-primary rounded-full"></div>
                      )}
                    </div>
                    
                    <p className="text-gray-600 dark:text-gray-400 mb-3">{notification.message}</p>
                    
                    <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                      <div className="flex items-center">
                        <CalendarIcon className="w-4 h-4 mr-1" />
                        <span>{formatDate(notification.created_at)}</span>
                      </div>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        notification.type === 'error' ? 'bg-red-100 text-red-800' :
                        notification.type === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                        notification.type === 'success' ? 'bg-green-100 text-green-800' :
                        'bg-blue-100 text-blue-800'
                      }`}>
                        {notification.type}
                      </span>
                    </div>
                  </div>
                  
                  <div className="ml-4">
                    {(notification as any).read_at ? (
                      <CheckCircleIcon className="w-5 h-5 text-green-600" />
                    ) : (
                      <ClockIcon className="w-5 h-5 text-yellow-600" />
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Messages */}
      <div className="p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-card">
        <h2 className="text-xl font-bold text-primary mb-6">Recent Messages</h2>
        
        {messages.length === 0 ? (
          <div className="text-center py-12">
            <MessageSquareIcon className="w-16 h-16 mx-auto text-gray-400 dark:text-gray-500 mb-4" />
            <h3 className="text-lg font-semibold text-gray-600 dark:text-gray-300 mb-2">No messages yet</h3>
            <p className="text-gray-500 dark:text-gray-400">Start a conversation with your team members.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.slice(0, 5).map((message) => (
              <div key={message.id} className="p-4 border border-gray-200 dark:border-gray-700 rounded-xl hover:shadow-lg transition-shadow">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`p-2 rounded-full ${
                        message.type === 'alert' ? 'bg-orange-100' :
                        message.type === 'announcement' ? 'bg-purple-100' :
                        'bg-blue-100'
                      }`}>
                        {getTypeIcon(message.type)}
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        {message.subject}
                      </h3>
                    </div>
                    
                    <p className="text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">{message.content}</p>
                    
                    <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                      <div className="flex items-center">
                        <UserIcon className="w-4 h-4 mr-1" />
                        <span>To: {getUserName(message.receiver_id)}</span>
                      </div>
                      <div className="flex items-center">
                        <CalendarIcon className="w-4 h-4 mr-1" />
                        <span>{formatDate(message.created_at)}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex flex-col gap-2 ml-4">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getPriorityColor(message.priority)}`}>
                      {message.priority}
                    </span>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getTypeColor(message.type)}`}>
                      {message.type}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Send Message Modal */}
      {showMessageModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-primary">Send Message</h3>
              <button
                onClick={() => setShowMessageModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  To *
                </label>
                <select
                  value={newMessage.receiver_id}
                  onChange={(e) => setNewMessage({ ...newMessage, receiver_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                >
                  <option value="">Select team member</option>
                  {teamMembers.map(member => (
                    <option key={member.id} value={member.id}>{member.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Subject *
                </label>
                <input
                  type="text"
                  value={newMessage.subject}
                  onChange={(e) => setNewMessage({ ...newMessage, subject: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
                  placeholder="Message subject"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Message *
                </label>
                <textarea
                  value={newMessage.content}
                  onChange={(e) => setNewMessage({ ...newMessage, content: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent resize-none bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
                  rows={4}
                  placeholder="Type your message here"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Priority
                </label>
                <select
                  value={newMessage.priority}
                  onChange={(e) => setNewMessage({ ...newMessage, priority: e.target.value as 'Low' | 'Medium' | 'High' })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                >
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleSendMessage}
                  disabled={sendingMessage}
                  className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  {sendingMessage ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                      Sending...
                    </>
                  ) : (
                    <>
                      <SendIcon className="w-4 h-4 mr-2 inline" />
                      Send Message
                    </>
                  )}
                </button>
                <button
                  onClick={() => setShowMessageModal(false)}
                  disabled={sendingMessage}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Send Announcement Modal */}
      {showAnnouncementModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-primary">Send Announcement</h3>
              <button
                onClick={() => setShowAnnouncementModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Subject *
                </label>
                <input
                  type="text"
                  value={newMessage.subject}
                  onChange={(e) => setNewMessage({ ...newMessage, subject: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  placeholder="Announcement subject"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Message *
                </label>
                <textarea
                  value={newMessage.content}
                  onChange={(e) => setNewMessage({ ...newMessage, content: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
                  rows={4}
                  placeholder="Type your announcement here"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Priority
                </label>
                <select
                  value={newMessage.priority}
                  onChange={(e) => setNewMessage({ ...newMessage, priority: e.target.value as 'Low' | 'Medium' | 'High' })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                >
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                </select>
              </div>

              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  This announcement will be sent to all {teamMembers.length} team members.
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleSendAnnouncement}
                  disabled={sendingAnnouncement}
                  className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  {sendingAnnouncement ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                      Sending...
                    </>
                  ) : (
                    <>
                      <BellIcon className="w-4 h-4 mr-2 inline" />
                      Send Announcement
                    </>
                  )}
                </button>
                <button
                  onClick={() => setShowAnnouncementModal(false)}
                  disabled={sendingAnnouncement}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Communication;
