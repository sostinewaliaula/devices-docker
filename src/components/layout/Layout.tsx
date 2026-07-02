import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
const Layout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };
  return <div className="flex h-screen bg-white dark:bg-gray-950">
      {/* Sidebar for mobile */}
      <div className={`fixed inset-0 z-20 transition-opacity bg-black bg-opacity-50 lg:hidden ${sidebarOpen ? 'opacity-100 ease-out duration-300' : 'opacity-0 ease-in duration-300 pointer-events-none'}`} onClick={toggleSidebar}></div>
      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-30 w-64 overflow-y-auto transition duration-300 transform bg-white dark:bg-gray-900 lg:translate-x-0 lg:static lg:inset-0 ${sidebarOpen ? 'translate-x-0 ease-out' : '-translate-x-full ease-in'}`}>
        <Sidebar closeSidebar={() => setSidebarOpen(false)} />
      </div>
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header toggleSidebar={toggleSidebar} />
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-lightred dark:bg-gray-950">
          <div className="container px-4 py-6 mx-auto lg:px-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>;
};
export default Layout;
