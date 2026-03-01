import React, { useState, useEffect } from 'react';
import { apiFetch as fetch } from './api';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  Calendar, 
  Shield, 
  UserPlus, 
  ChevronLeft, 
  ChevronRight, 
  Save, 
  Trash2, 
  Edit2, 
  CheckCircle2, 
  XCircle,
  BarChart3,
  Settings,
  LogOut,
  Lock,
  MessageSquare,
  Info,
  Send,
  Download,
  RefreshCw
} from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// --- Types ---

type Role = 'teacher' | 'principal' | null;

interface Student {
  id: number;
  name: string;
  classId: number;
}

interface Class {
  id: number;
  name: string;
}

interface AttendanceRecord {
  studentId: number;
  status: 'P' | 'A';
}

interface ReportItem {
  id: number;
  name: string;
  presentCount: number;
  absentCount: number;
  percentage: number;
  records: { status: string; date: string }[];
}

// --- Constants ---

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

// --- Hooks ---

function useLongPress(callback: () => void, ms = 500) {
  const [startLongPress, setStartLongPress] = useState(false);

  useEffect(() => {
    let timer: any;
    if (startLongPress) {
      timer = setTimeout(callback, ms);
    } else {
      clearTimeout(timer);
    }
    return () => clearTimeout(timer);
  }, [startLongPress, callback, ms]);

  return {
    onMouseDown: () => setStartLongPress(true),
    onMouseUp: () => setStartLongPress(false),
    onMouseLeave: () => setStartLongPress(false),
    onTouchStart: () => setStartLongPress(true),
    onTouchEnd: () => setStartLongPress(false),
  };
}

function LongPressDiv({ children, onLongPress, className }: { children: React.ReactNode, onLongPress: () => void, className?: string, key?: any }) {
  const longPressProps = useLongPress(onLongPress);
  return (
    <div {...longPressProps} className={className}>
      {children}
    </div>
  );
}

// --- Components ---

const AppLogo = ({ className = "w-8 h-8 rounded-xl" }: { className?: string }) => (
  <div className={`${className} bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-200/50 overflow-hidden relative`}>
    <div className="absolute inset-0 bg-gradient-to-tr from-white/20 to-transparent" />
    <svg width="60%" height="60%" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 12L9 17L20 6" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  </div>
);

const ClassIcon = () => (
  <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center border border-slate-100 group-hover:bg-indigo-600 transition-all duration-300 shadow-sm">
    <Users className="text-slate-400 group-hover:text-white w-6 h-6 transition-colors" strokeWidth={2} />
  </div>
);

const StudentAvatar = ({ hasData, percentage }: { hasData: boolean, percentage: number }) => (
  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${!hasData ? 'bg-slate-100 text-slate-400' : percentage >= 75 ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
    <Users size={18} strokeWidth={2.5} />
  </div>
);

export default function App() {
  const [role, setRole] = useState<Role>(null);
  const [isSetup, setIsSetup] = useState<boolean | null>(null);
  const [startMonth, setStartMonth] = useState<string | null>(null);
  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedClass, setSelectedClass] = useState<any | null>(null);
  const [view, setView] = useState<'dashboard' | 'students' | 'attendance' | 'reports'>('students');
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return localStorage.getItem('attendify_principal_auth') === 'true';
  });
  const [teacherClass, setTeacherClass] = useState<any | null>(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // Shared and persistent date across the entire app
  const [sharedDate, setSharedDate] = useState(() => {
    return localStorage.getItem('attendify_global_date') || new Date().toISOString().split('T')[0];
  });

  useEffect(() => {
    localStorage.setItem('attendify_global_date', sharedDate);
  }, [sharedDate]);

  useEffect(() => {
    fetch('/api/config/start_month')
      .then(res => res.json())
      .then(data => {
        if (data.value) {
          setIsSetup(true);
          setStartMonth(data.value);
        } else {
          setIsSetup(false);
        }
      });

    fetch('/api/classes')
      .then(res => res.json())
      .then(setClasses);
  }, []);

  const handleRoleSelect = (selectedRole: Role) => {
    setRole(selectedRole);
  };

  const handleTeacherLogin = (cls: any) => {
    setTeacherClass(cls);
  };

  const handlePrincipalLogin = () => {
    setIsAuthenticated(true);
    localStorage.setItem('attendify_principal_auth', 'true');
    localStorage.setItem('attendify_role', 'principal');
  };

  const handleLogout = () => {
    localStorage.removeItem('attendify_teacher_class');
    localStorage.removeItem('attendify_role');
    localStorage.removeItem('attendify_principal_auth');
    setTeacherClass(null);
    setRole(null);
    setIsAuthenticated(false);
    setShowLogoutConfirm(false);
    setSelectedClass(null);
    setView('students');
  };

  if (!role) {
    return <RoleSelection onSelect={handleRoleSelect} />;
  }

  if (role === 'principal' && !isAuthenticated) {
    return <PrincipalLogin onLogin={handlePrincipalLogin} onBack={() => handleRoleSelect(null)} />;
  }

  if (role === 'teacher' && !teacherClass) {
    return <TeacherLogin onLogin={handleTeacherLogin} onBack={() => handleRoleSelect(null)} />;
  }

  if (role === 'teacher' && isSetup === false) {
    return <TeacherSetup onComplete={(month) => {
      setIsSetup(true);
      setStartMonth(month);
    }} />;
  }

  return (
    <div className="min-h-screen font-sans text-slate-900">
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 px-4 py-3 sticky top-0 z-10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AppLogo />
          <h1 className="text-lg font-bold tracking-tight text-indigo-900">Attendify</h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 py-1 bg-slate-100 rounded">
            {role === 'teacher' ? `${teacherClass.name} - ${teacherClass.section}` : 'Principal'}
          </span>
          <button 
            onClick={() => setShowLogoutConfirm(true)}
            className="p-2 text-slate-400 hover:text-red-500 transition-colors"
          >
            <LogOut size={20} />
          </button>
        </div>
      </header>

      <AnimatePresence>
        {showLogoutConfirm && (
          <LogoutConfirmation 
            onConfirm={handleLogout} 
            onCancel={() => setShowLogoutConfirm(false)} 
          />
        )}
      </AnimatePresence>

      <main className="max-w-md mx-auto p-4 pb-24">
        {role === 'teacher' ? (
          <TeacherDashboard 
            selectedClass={teacherClass} 
            view={view}
            setView={setView}
            sharedDate={sharedDate}
            setSharedDate={setSharedDate}
          />
        ) : (
          <PrincipalDashboard 
            classes={classes}
            selectedClass={selectedClass}
            setSelectedClass={setSelectedClass}
            sharedDate={sharedDate}
            setSharedDate={setSharedDate}
          />
        )}
      </main>
    </div>
  );
}

function RoleSelection({ onSelect }: { onSelect: (role: Role) => void }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-12 relative z-10"
      >
        <div className="text-indigo-900 font-black text-2xl mb-4 tracking-tight">N.V.N School</div>
        <div className="relative inline-block mb-6">
          <div className="absolute inset-0 bg-indigo-500 blur-2xl opacity-20 rounded-full" />
          <AppLogo className="w-24 h-24 rounded-[2rem] mx-auto relative z-10 shadow-xl border-4 border-white" />
        </div>
        <h1 className="text-4xl font-black tracking-tight mb-2 text-indigo-900">Attendify</h1>
        <p className="text-indigo-600 font-semibold tracking-wide uppercase text-[10px]">Smart School Attendance System</p>
      </motion.div>

      <div className="w-full max-w-xs space-y-4 relative z-10">
        <button 
          onClick={() => onSelect('teacher')}
          className="w-full bg-white/90 backdrop-blur-sm text-indigo-900 p-5 rounded-2xl font-bold flex items-center justify-between group hover:bg-sky-50 transition-all shadow-lg border-2 border-sky-200 hover:border-sky-500"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-sky-100 rounded-xl text-sky-600 group-hover:bg-sky-600 group-hover:text-white transition-colors">
              <Users size={24} />
            </div>
            <div className="text-left">
              <div className="text-lg leading-tight">Teacher</div>
              <div className="text-[10px] font-medium text-slate-400 uppercase tracking-wider mt-0.5">Enter class passcode</div>
            </div>
          </div>
          <ChevronRight size={20} className="text-sky-300 group-hover:text-sky-500 transition-colors" />
        </button>

        <button 
          onClick={() => onSelect('principal')}
          className="w-full bg-white/90 backdrop-blur-sm text-indigo-900 p-5 rounded-2xl font-bold flex items-center justify-between group hover:bg-sky-50 transition-all shadow-lg border-2 border-sky-200 hover:border-sky-500"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-sky-100 rounded-xl text-sky-600 group-hover:bg-sky-600 group-hover:text-white transition-colors">
              <Shield size={24} />
            </div>
            <div className="text-left">
              <div className="text-lg leading-tight">Principal</div>
              <div className="text-[10px] font-medium text-slate-400 uppercase tracking-wider mt-0.5">View school reports</div>
            </div>
          </div>
          <ChevronRight size={20} className="text-sky-300 group-hover:text-sky-500 transition-colors" />
        </button>
      </div>
    </div>
  );
}

function TeacherLogin({ onLogin, onBack }: { onLogin: (cls: any) => void, onBack: () => void }) {
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/teacher/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passcode: passcode.toUpperCase() })
    });
    if (res.ok) {
      const data = await res.json();
      onLogin(data.class);
    } else {
      setError('Invalid password');
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-sm bg-white p-8 rounded-3xl shadow-xl border border-slate-100"
      >
        <button onClick={onBack} className="mb-6 text-slate-400 hover:text-indigo-600 flex items-center gap-1 text-sm font-medium">
          <ChevronLeft size={16} /> Back
        </button>
        
        <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600 mb-6">
          <Users size={32} />
        </div>
        
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Teacher Login</h2>
        <p className="text-slate-500 text-sm mb-8">Enter your class passcode to access attendance records.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Class Passcode</label>
            <input 
              type="text" 
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all uppercase"
              placeholder="Enter Passcode"
              autoFocus
            />
          </div>
          {error && <p className="text-red-500 text-xs font-medium">{error}</p>}
          <button 
            type="submit"
            className="w-full bg-indigo-600 text-white p-4 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
          >
            Access Class
          </button>
        </form>
      </motion.div>
    </div>
  );
}

function LogoutConfirmation({ onConfirm, onCancel }: { onConfirm: () => void, onCancel: () => void }) {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm"
    >
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="w-full max-w-xs bg-white rounded-3xl p-6 shadow-2xl text-center"
      >
        <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center text-red-600 mb-4 mx-auto">
          <LogOut size={32} />
        </div>
        <h3 className="text-xl font-bold text-slate-900 mb-2">Logout?</h3>
        <p className="text-slate-500 text-sm mb-6">Are you sure you want to log out of your session?</p>
        <div className="flex flex-col gap-2">
          <button 
            onClick={onConfirm}
            className="w-full bg-red-500 text-white p-4 rounded-xl font-bold hover:bg-red-600 transition-all"
          >
            Yes, Logout
          </button>
          <button 
            onClick={onCancel}
            className="w-full bg-slate-100 text-slate-600 p-4 rounded-xl font-bold hover:bg-slate-200 transition-all"
          >
            Cancel
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function PrincipalLogin({ onLogin, onBack }: { onLogin: () => void, onBack: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });
    if (res.ok) {
      onLogin();
    } else {
      setError('Invalid password');
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-sm bg-white p-8 rounded-3xl shadow-xl border border-slate-100"
      >
        <button onClick={onBack} className="mb-6 text-slate-400 hover:text-indigo-600 flex items-center gap-1 text-sm font-medium">
          <ChevronLeft size={16} /> Back
        </button>
        
        <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600 mb-6">
          <Lock size={32} />
        </div>
        
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Secure Access</h2>
        <p className="text-slate-500 text-sm mb-8">Enter the principal password to view administrative reports.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Password</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
              placeholder="Enter Password"
              autoFocus
            />
          </div>
          {error && <p className="text-red-500 text-xs font-medium">{error}</p>}
          <button 
            type="submit"
            className="w-full bg-indigo-600 text-white p-4 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
          >
            Login to Dashboard
          </button>
        </form>
      </motion.div>
    </div>
  );
}

function TeacherSetup({ onComplete }: { onComplete: (month: string) => void }) {
  const [selectedMonth, setSelectedMonth] = useState('');

  const handleSave = async () => {
    if (!selectedMonth) return;
    await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'start_month', value: selectedMonth })
    });
    onComplete(selectedMonth);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm bg-white p-8 rounded-3xl shadow-xl border border-slate-100 text-center"
      >
        <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600 mb-6 mx-auto">
          <Calendar size={32} />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mb-4">First-Time Setup</h2>
        <p className="text-slate-500 text-sm mb-8">Select the month from which you want to start attendance tracking.</p>

        <div className="space-y-6">
          <select 
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none appearance-none"
          >
            <option value="">Select Month</option>
            {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
          </select>

          <button 
            onClick={handleSave}
            disabled={!selectedMonth}
            className="w-full bg-indigo-600 text-white p-4 rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-lg shadow-indigo-200"
          >
            Start Attendance
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function TeacherDashboard({ selectedClass, view, setView, sharedDate, setSharedDate }: any) {
  const [remark, setRemark] = useState("");
  const [countdown, setCountdown] = useState(20);
  const [isInitialNotice, setIsInitialNotice] = useState(false);
  const [isNoticeDeleted, setIsNoticeDeleted] = useState(() => {
    return localStorage.getItem('attendify_notice_deleted') === 'true';
  });

  useEffect(() => {
    fetch('/api/config/remark')
      .then(res => res.json())
      .then(data => {
        if (data.value) {
          setRemark(data.value);
          const seenRemark = localStorage.getItem('attendify_seen_remark');
          
          // If it's a NEW notice (different from what was last seen/deleted)
          if (seenRemark !== data.value) {
            setIsNoticeDeleted(false);
            localStorage.removeItem('attendify_notice_deleted');
            setCountdown(20);
            setIsInitialNotice(true);
          }
        }
      });
  }, []);

  useEffect(() => {
    let timer: any;
    if (!isNoticeDeleted && countdown > 0 && isInitialNotice) {
      timer = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isNoticeDeleted, countdown, isInitialNotice]);

  const handleDeleteNotice = () => {
    if (isInitialNotice && countdown > 0) return;
    setIsNoticeDeleted(true);
    localStorage.setItem('attendify_notice_deleted', 'true');
    localStorage.setItem('attendify_seen_remark', remark);
  };

  const handleRestoreNotice = () => {
    setIsNoticeDeleted(false);
    localStorage.removeItem('attendify_notice_deleted');
    setCountdown(0); 
    setIsInitialNotice(false);
  };

  return (
    <div className="space-y-6">
      {remark && !isNoticeDeleted ? (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-indigo-600 to-violet-600 p-6 rounded-3xl text-white shadow-xl relative overflow-hidden"
        >
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2 opacity-80">
              <MessageSquare size={16} />
              <span className="text-[10px] font-black uppercase tracking-widest">Principal's Notice</span>
            </div>
            <p className="text-lg font-bold leading-tight mb-1">"{remark}"</p>
            <p className="text-[10px] font-medium opacity-70 mb-4">— By the Principal</p>
            
            <button 
              onClick={handleDeleteNotice}
              disabled={isInitialNotice && countdown > 0}
              className={`w-full py-3 rounded-xl font-black text-sm transition-all flex flex-col items-center ${
                isInitialNotice && countdown > 0 
                  ? 'bg-white/10 text-white/40 cursor-not-allowed' 
                  : 'bg-white text-indigo-600 hover:bg-indigo-50 active:scale-95'
              }`}
            >
              <span>Delete Notice</span>
              {isInitialNotice && countdown > 0 && (
                <span className="text-[8px] font-medium mt-0.5">Please wait {countdown}s</span>
              )}
            </button>
          </div>
          <div className="absolute -right-4 -bottom-4 opacity-10">
            <MessageSquare size={120} />
          </div>
        </motion.div>
      ) : remark && (
        <div className="flex justify-end px-2">
          <button 
            onClick={handleRestoreNotice}
            className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:text-indigo-700 transition-all bg-indigo-50 px-3 py-1.5 rounded-full"
          >
            <RefreshCw size={10} /> Restore Notice
          </button>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h2 className="font-bold text-indigo-900 text-xl">{selectedClass.name} - Section {selectedClass.section}</h2>
      </div>

      <div className="flex bg-white p-1 rounded-2xl border border-slate-200 shadow-sm">
        <button 
          onClick={() => setView('students')}
          className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${view === 'students' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
        >
          Students
        </button>
        <button 
          onClick={() => setView('dashboard')}
          className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${view === 'dashboard' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
        >
          Daily
        </button>
        <button 
          onClick={() => setView('reports')}
          className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${view === 'reports' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
        >
          Reports
        </button>
      </div>

      <AnimatePresence mode="wait">
        {view === 'dashboard' && <AttendanceMarking key="attendance" classId={selectedClass.id} sharedDate={sharedDate} setSharedDate={setSharedDate} />}
        {view === 'students' && <StudentManagement key="students" classId={selectedClass.id} sharedDate={sharedDate} setSharedDate={setSharedDate} />}
        {view === 'reports' && <ClassReports key="reports" classId={selectedClass.id} sharedDate={sharedDate} setSharedDate={setSharedDate} />}
      </AnimatePresence>
    </div>
  );
}

function AttendanceMarking({ classId, sharedDate, setSharedDate }: { classId: number, sharedDate: string, setSharedDate: (d: string) => void, key?: string }) {
  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<Record<number, 'P' | 'A'>>({});
  const [isSaved, setIsSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Swipe logic states
  const [swipeStep, setSwipeStep] = useState<'date' | 'month' | 'year'>('date');
  
  // Long press state
  const [longPressedStudent, setLongPressedStudent] = useState<Student | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');

  const today = new Date().toISOString().split('T')[0];
  const isSunday = new Date(sharedDate + 'T00:00:00').getDay() === 0;

  useEffect(() => {
    setLoading(true);
    const loadData = async () => {
      const sRes = await fetch(`/api/students/${classId}`);
      const sData = await sRes.json();
      setStudents(sData);

      const aRes = await fetch(`/api/attendance/${classId}/${sharedDate}`);
      const aData = await aRes.json();
      
      const attMap: Record<number, 'P' | 'A'> = {};
      aData.forEach((r: any) => {
        attMap[r.student_id] = r.status;
      });
      setAttendance(attMap);
      setIsSaved(aData.length > 0);
      setLoading(false);
    };
    loadData();
  }, [classId, sharedDate]);

  const handleStatusChange = (studentId: number, status: 'P' | 'A') => {
    if (sharedDate > today || isSunday) return;
    setAttendance(prev => ({ ...prev, [studentId]: status }));
  };

  const handleSave = async () => {
    if (isSunday) return;
    setIsSaving(true);
    const records = Object.entries(attendance).map(([id, status]) => ({
      studentId: parseInt(id),
      status
    }));
    
    await fetch('/api/attendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: sharedDate, records })
    });
    setIsSaved(true);
    setTimeout(() => setIsSaving(false), 600); // Visual feedback duration
  };

  const handleDeleteStudent = async (id: number) => {
    try {
      const res = await fetch(`/api/students/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setStudents(prev => prev.filter(s => s.id !== id));
        setLongPressedStudent(null);
      } else {
        const data = await res.json();
        alert(data.message || 'Failed to delete student.');
      }
    } catch (err) {
      console.error('Delete error:', err);
      alert('Network error while deleting student.');
    }
  };

  const handleUpdateStudent = async (id: number) => {
    if (!editName.trim()) return;
    await fetch(`/api/students/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editName })
    });
    setStudents(students.map(s => s.id === id ? { ...s, name: editName } : s));
    setIsEditing(false);
    setLongPressedStudent(null);
  };

  const handleSwipe = (direction: 'left' | 'right') => {
    if (direction === 'left') {
      if (swipeStep === 'date') setSwipeStep('month');
      else if (swipeStep === 'month') setSwipeStep('year');
    } else {
      if (swipeStep === 'year') setSwipeStep('month');
      else if (swipeStep === 'month') setSwipeStep('date');
    }
  };

  const changeMonth = (delta: number) => {
    const current = new Date(sharedDate);
    current.setMonth(current.getMonth() + delta);
    setSharedDate(current.toISOString().split('T')[0]);
  };

  const changeYear = (delta: number) => {
    const current = new Date(sharedDate);
    current.setFullYear(current.getFullYear() + delta);
    setSharedDate(current.toISOString().split('T')[0]);
  };

  if (loading) return <div className="text-center py-12 text-slate-400">Loading students...</div>;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-4"
    >
      <AnimatePresence>
        {longPressedStudent && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-xs bg-white rounded-3xl p-6 shadow-2xl"
            >
              <h3 className="text-xl font-bold text-slate-900 mb-4">Student Options</h3>
              
              {isEditing ? (
                <div className="space-y-4">
                  <input 
                    type="text" 
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button 
                      onClick={() => handleUpdateStudent(longPressedStudent.id)}
                      className="flex-1 bg-indigo-600 text-white p-3 rounded-xl font-bold"
                    >
                      Save
                    </button>
                    <button 
                      onClick={() => setIsEditing(false)}
                      className="flex-1 bg-slate-100 text-slate-600 p-3 rounded-xl font-bold"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <button 
                    onClick={() => { setIsEditing(true); setEditName(longPressedStudent.name); }}
                    className="w-full flex items-center gap-3 p-4 bg-slate-50 hover:bg-indigo-50 text-slate-700 rounded-2xl transition-all"
                  >
                    <Edit2 size={20} className="text-indigo-500" />
                    <span className="font-bold">Rename Student</span>
                  </button>
                  <button 
                    onClick={() => handleDeleteStudent(longPressedStudent.id)}
                    className="w-full flex items-center gap-3 p-4 bg-slate-50 hover:bg-rose-50 text-slate-700 rounded-2xl transition-all"
                  >
                    <Trash2 size={20} className="text-rose-500" />
                    <span className="font-bold">Delete Student</span>
                  </button>
                  <button 
                    onClick={() => setLongPressedStudent(null)}
                    className="w-full p-4 text-slate-400 font-bold mt-2"
                  >
                    Close
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="relative overflow-hidden bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
        <motion.div 
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          onDragEnd={(_, info) => {
            if (info.offset.x < -50) handleSwipe('left');
            if (info.offset.x > 50) handleSwipe('right');
          }}
          className="cursor-grab active:cursor-grabbing"
        >
          <AnimatePresence mode="wait">
            {swipeStep === 'date' && (
              <motion.div 
                key="date"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex items-center justify-between"
              >
                <div className="flex flex-col">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Select Date</span>
                  <input 
                    type="date" 
                    value={sharedDate}
                    max={today}
                    onChange={(e) => setSharedDate(e.target.value)}
                    className="font-black text-indigo-900 outline-none bg-transparent text-lg"
                  />
                </div>
                <div className="text-slate-300 flex items-center gap-1 text-[10px] font-bold uppercase">
                  Swipe <ChevronRight size={12} />
                </div>
              </motion.div>
            )}

            {swipeStep === 'month' && (
              <motion.div 
                key="month"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex items-center justify-between"
              >
                <div className="flex flex-col">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Select Month</span>
                  <div className="flex items-center gap-4 mt-1">
                    <button onClick={() => changeMonth(-1)} className="p-1 bg-slate-100 rounded-lg text-slate-600"><ChevronLeft size={16}/></button>
                    <span className="font-black text-indigo-900 text-lg">{MONTHS[new Date(sharedDate).getMonth()]}</span>
                    <button onClick={() => changeMonth(1)} className="p-1 bg-slate-100 rounded-lg text-slate-600"><ChevronRight size={16}/></button>
                  </div>
                </div>
                <div className="text-slate-300 flex items-center gap-1 text-[10px] font-bold uppercase">
                  <ChevronLeft size={12} /> Swipe <ChevronRight size={12} />
                </div>
              </motion.div>
            )}

            {swipeStep === 'year' && (
              <motion.div 
                key="year"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex items-center justify-between"
              >
                <div className="flex flex-col">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Select Year</span>
                  <div className="flex items-center gap-4 mt-1">
                    <button onClick={() => changeYear(-1)} className="p-1 bg-slate-100 rounded-lg text-slate-600"><ChevronLeft size={16}/></button>
                    <span className="font-black text-indigo-900 text-lg">{new Date(sharedDate).getFullYear()}</span>
                    <button onClick={() => changeYear(1)} className="p-1 bg-slate-100 rounded-lg text-slate-600"><ChevronRight size={16}/></button>
                  </div>
                </div>
                <div className="text-slate-300 flex items-center gap-1 text-[10px] font-bold uppercase">
                  <ChevronLeft size={12} /> Swipe
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      <div className="flex items-center justify-between px-2">
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Student List</span>
        <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${isSunday ? 'bg-rose-100 text-rose-600' : isSaved ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
          {isSunday ? 'Holiday (Sunday)' : isSaved ? 'Saved' : 'Pending'}
        </div>
      </div>

      {isSunday ? (
        <div className="bg-white p-12 rounded-3xl border border-dashed border-slate-300 text-center">
          <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <Calendar size={32} className="text-rose-300" />
          </div>
          <p className="text-slate-400 text-sm font-bold uppercase tracking-widest">Sunday Holiday</p>
          <p className="text-slate-300 text-xs mt-1">Attendance cannot be marked on Sundays.</p>
        </div>
      ) : students.length === 0 ? (
        <div className="bg-white p-12 rounded-3xl border border-dashed border-slate-300 text-center">
          <p className="text-slate-400 text-sm">No students added to this class yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {students.map(student => (
            <LongPressDiv 
              key={student.id} 
              onLongPress={() => setLongPressedStudent(student)}
              className="bg-white p-4 rounded-2xl border border-slate-200 flex items-center justify-between shadow-sm active:bg-slate-50 transition-colors select-none"
            >
              <span className="font-bold text-slate-700">{student.name}</span>
              <div className="flex gap-2">
                <button 
                  onClick={() => handleStatusChange(student.id, 'P')}
                  className={`w-10 h-10 rounded-xl font-black transition-all ${attendance[student.id] === 'P' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-100' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}
                >
                  P
                </button>
                <button 
                  onClick={() => handleStatusChange(student.id, 'A')}
                  className={`w-10 h-10 rounded-xl font-black transition-all ${attendance[student.id] === 'A' ? 'bg-rose-500 text-white shadow-lg shadow-rose-100' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}
                >
                  A
                </button>
              </div>
            </LongPressDiv>
          ))}
        </div>
      )}

      {!isSunday && students.length > 0 && (
        <motion.button 
          whileTap={{ scale: 0.95 }}
          onClick={handleSave}
          disabled={isSaving}
          className={`w-full p-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg mt-6 ${isSaving ? 'bg-emerald-500 text-white' : 'bg-indigo-600 text-white shadow-indigo-100 hover:bg-indigo-700'}`}
        >
          {isSaving ? (
            <motion.div 
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-2"
            >
              <CheckCircle2 size={20} /> Saved!
            </motion.div>
          ) : (
            <>
              <Save size={20} /> Save Attendance
            </>
          )}
        </motion.button>
      )}
    </motion.div>
  );
}

function StudentManagement({ classId, sharedDate, setSharedDate }: { classId: number, sharedDate: string, setSharedDate: (d: string) => void, key?: string }) {
  const [students, setStudents] = useState<Student[]>([]);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  
  // Long press state
  const [longPressedStudent, setLongPressedStudent] = useState<Student | null>(null);
  const [isLongPressEditing, setIsLongPressEditing] = useState(false);
  const [longPressEditName, setLongPressEditName] = useState('');

  useEffect(() => {
    fetch(`/api/students/${classId}`).then(res => res.json()).then(setStudents);
  }, [classId]);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    const res = await fetch('/api/students', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ classId, name: newName })
    });
    const student = await res.json();
    setStudents([...students, student]);
    setNewName('');
  };

  const handleDelete = async (id: number) => {
    try {
      const res = await fetch(`/api/students/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setStudents(prev => prev.filter(s => s.id !== id));
        setLongPressedStudent(null);
      } else {
        const data = await res.json();
        alert(data.message || 'Failed to delete student.');
      }
    } catch (err) {
      console.error('Delete error:', err);
      alert('Network error while deleting student.');
    }
  };

  const handleUpdate = async (id: number, name: string) => {
    if (!name.trim()) return;
    await fetch(`/api/students/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });
    setStudents(students.map(s => s.id === id ? { ...s, name } : s));
    setEditingId(null);
    setIsLongPressEditing(false);
    setLongPressedStudent(null);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-6"
    >
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Selected Date</span>
          <input 
            type="date" 
            value={sharedDate}
            onChange={(e) => setSharedDate(e.target.value)}
            className="font-bold text-indigo-900 outline-none bg-transparent"
          />
        </div>
        <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
          <Calendar size={20} />
        </div>
      </div>

      <AnimatePresence>
        {longPressedStudent && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-xs bg-white rounded-3xl p-6 shadow-2xl"
            >
              <h3 className="text-xl font-bold text-slate-900 mb-4">Student Options</h3>
              
              {isLongPressEditing ? (
                <div className="space-y-4">
                  <input 
                    type="text" 
                    value={longPressEditName}
                    onChange={(e) => setLongPressEditName(e.target.value)}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button 
                      onClick={() => handleUpdate(longPressedStudent.id, longPressEditName)}
                      className="flex-1 bg-indigo-600 text-white p-3 rounded-xl font-bold"
                    >
                      Save
                    </button>
                    <button 
                      onClick={() => setIsLongPressEditing(false)}
                      className="flex-1 bg-slate-100 text-slate-600 p-3 rounded-xl font-bold"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <button 
                    onClick={() => { setIsLongPressEditing(true); setLongPressEditName(longPressedStudent.name); }}
                    className="w-full flex items-center gap-3 p-4 bg-slate-50 hover:bg-indigo-50 text-slate-700 rounded-2xl transition-all"
                  >
                    <Edit2 size={20} className="text-indigo-500" />
                    <span className="font-bold">Rename Student</span>
                  </button>
                  <button 
                    onClick={() => handleDelete(longPressedStudent.id)}
                    className="w-full flex items-center gap-3 p-4 bg-slate-50 hover:bg-rose-50 text-slate-700 rounded-2xl transition-all"
                  >
                    <Trash2 size={20} className="text-rose-500" />
                    <span className="font-bold">Delete Student</span>
                  </button>
                  <button 
                    onClick={() => setLongPressedStudent(null)}
                    className="w-full p-4 text-slate-400 font-bold mt-2"
                  >
                    Close
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Add New Student</label>
        <div className="flex gap-2">
          <input 
            type="text" 
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Student Name"
          />
          <button 
            onClick={handleAdd}
            className="bg-indigo-600 text-white p-3 rounded-xl hover:bg-indigo-700 transition-all"
          >
            <UserPlus size={20} />
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between items-center px-1">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Student List ({students.length})</h3>
        </div>
        {students.map(student => (
          <LongPressDiv 
            key={student.id} 
            onLongPress={() => setLongPressedStudent(student)}
            className="bg-white p-4 rounded-2xl border border-slate-200 flex items-center justify-between shadow-sm group active:bg-slate-50 transition-colors select-none"
          >
            {editingId === student.id ? (
              <div className="flex-1 flex gap-2 mr-2">
                <input 
                  type="text" 
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="flex-1 p-2 bg-slate-50 border border-slate-200 rounded-lg outline-none"
                  autoFocus
                />
                <button onClick={() => handleUpdate(student.id, editName)} className="text-emerald-500"><CheckCircle2 size={20} /></button>
                <button onClick={() => setEditingId(null)} className="text-slate-400"><XCircle size={20} /></button>
              </div>
            ) : (
              <>
                <span className="font-bold text-slate-700">{student.name}</span>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={() => { setEditingId(student.id); setEditName(student.name); }}
                    className="p-2 text-slate-400 hover:text-indigo-600"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button 
                    onClick={() => handleDelete(student.id)}
                    className="p-2 text-slate-400 hover:text-red-500"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </>
            )}
          </LongPressDiv>
        ))}
      </div>
    </motion.div>
  );
}

function ClassReports({ classId, sharedDate, setSharedDate }: { classId: number, sharedDate: string, setSharedDate: (d: string) => void, key?: string }) {
  const [month, setMonth] = useState(() => sharedDate.slice(0, 7));
  const [year, setYear] = useState(() => sharedDate.slice(0, 4));
  const [reportType, setReportType] = useState<'monthly' | 'yearly'>('monthly');
  const [report, setReport] = useState<ReportItem[]>([]);
  
  const years = Array.from({ length: 16 }, (_, i) => (2020 + i).toString());

  useEffect(() => {
    const endpoint = reportType === 'monthly' 
      ? `/api/reports/${classId}/${month}` 
      : `/api/reports/yearly/${classId}/${year}`;
    fetch(endpoint).then(res => res.json()).then(setReport);
    
    // Sync sharedDate when month/year changes in reports
    if (reportType === 'monthly') {
      const newDate = `${month}-01`;
      if (sharedDate.slice(0, 7) !== month) {
        setSharedDate(newDate);
      }
    } else {
      const newDate = `${year}-01-01`;
      if (sharedDate.slice(0, 4) !== year) {
        setSharedDate(newDate);
      }
    }
  }, [classId, month, year, reportType]);

  // Update local month/year when sharedDate changes externally
  useEffect(() => {
    setMonth(sharedDate.slice(0, 7));
    setYear(sharedDate.slice(0, 4));
  }, [sharedDate]);

  const handleExportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text('Attendance Report', 14, 22);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Period: ${reportType === 'monthly' ? month : year}`, 14, 30);
    
    const tableData = report.map(item => [
      item.name,
      item.presentCount.toString(),
      item.absentCount.toString(),
      `${item.percentage}%`
    ]);

    autoTable(doc, {
      head: [['Student Name', 'Present', 'Absent', 'Percentage']],
      body: tableData,
      startY: 35,
      theme: 'striped',
      headStyles: { fillColor: [79, 70, 229] }, // indigo-600
    });

    doc.save(`Attendance_Report_${classId}_${reportType === 'monthly' ? month : year}.pdf`);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-4"
    >
      <div className="flex bg-white p-1 rounded-2xl border border-slate-200 shadow-sm mb-4">
        <button 
          onClick={() => setReportType('monthly')}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${reportType === 'monthly' ? 'bg-indigo-100 text-indigo-600' : 'text-slate-500 hover:bg-slate-50'}`}
        >
          Monthly
        </button>
        <button 
          onClick={() => setReportType('yearly')}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${reportType === 'yearly' ? 'bg-indigo-100 text-indigo-600' : 'text-slate-500 hover:bg-slate-50'}`}
        >
          Annual
        </button>
      </div>

      <div className="flex justify-end px-1">
        <button 
          onClick={handleExportPDF}
          disabled={report.length === 0}
          className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-full disabled:opacity-50"
        >
          Export PDF
        </button>
      </div>

      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            {reportType === 'monthly' ? 'Select Month' : 'Select Year'}
          </span>
          {reportType === 'monthly' ? (
            <input 
              type="month" 
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="font-bold text-indigo-900 outline-none bg-transparent"
            />
          ) : (
            <select 
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="font-bold text-indigo-900 outline-none bg-transparent appearance-none"
            >
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          )}
        </div>
        <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600">
          <BarChart3 size={20} />
        </div>
      </div>

      <div className="space-y-3">
        {report.length > 0 && report.every(item => item.presentCount + item.absentCount === 0) ? (
          <div className="bg-white p-12 rounded-3xl border border-dashed border-slate-300 text-center">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Calendar size={32} className="text-slate-300" />
            </div>
            <p className="text-slate-400 text-sm font-bold uppercase tracking-widest">No Data Available</p>
            <p className="text-slate-300 text-xs mt-1">Attendance hasn't been marked for this period.</p>
          </div>
        ) : report.map(item => {
          const hasData = item.presentCount + item.absentCount > 0;
          return (
            <div key={item.id} className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h4 className="font-bold text-slate-800 text-lg">{item.name}</h4>
                  <p className="text-xs text-slate-400 font-medium tracking-wide uppercase">Attendance Summary</p>
                </div>
                <div className={`text-xl font-black ${!hasData ? 'text-slate-300' : item.percentage >= 75 ? 'text-emerald-500' : item.percentage >= 50 ? 'text-amber-500' : 'text-rose-500'}`}>
                  {hasData ? `${item.percentage}%` : 'N/A'}
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-emerald-50 p-3 rounded-2xl border border-emerald-100">
                  <div className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">Present</div>
                  <div className="text-2xl font-black text-emerald-700">{item.presentCount} <span className="text-xs font-medium text-emerald-600 opacity-60">days</span></div>
                </div>
                <div className="bg-rose-50 p-3 rounded-2xl border border-rose-100">
                  <div className="text-[10px] font-black text-rose-600 uppercase tracking-widest mb-1">Absent</div>
                  <div className="text-2xl font-black text-rose-700">{item.absentCount} <span className="text-xs font-medium text-rose-600 opacity-60">days</span></div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

function PrincipalDashboard({ classes, selectedClass, setSelectedClass, sharedDate, setSharedDate }: any) {
  const [selectedMonth, setSelectedMonth] = useState(() => sharedDate.slice(0, 7));
  const [selectedYear, setSelectedYear] = useState(() => sharedDate.slice(0, 4));
  const [reportType, setReportType] = useState<'monthly' | 'yearly'>('monthly');
  const [report, setReport] = useState<ReportItem[]>([]);
  const [selectedClassName, setSelectedClassName] = useState<string | null>(null);
  const [showRemarkInput, setShowRemarkInput] = useState(false);
  const [newRemark, setNewRemark] = useState("");
  const [isSavingRemark, setIsSavingRemark] = useState(false);

  useEffect(() => {
    fetch('/api/config/remark')
      .then(res => res.json())
      .then(data => setNewRemark(data.value));
  }, []);

  // Sync sharedDate when month/year changes in Principal view
  useEffect(() => {
    if (reportType === 'monthly') {
      const newDate = `${selectedMonth}-01`;
      if (sharedDate.slice(0, 7) !== selectedMonth) {
        setSharedDate(newDate);
      }
    } else {
      const newDate = `${selectedYear}-01-01`;
      if (sharedDate.slice(0, 4) !== selectedYear) {
        setSharedDate(newDate);
      }
    }
  }, [selectedMonth, selectedYear, reportType]);

  // Update local month/year when sharedDate changes externally
  useEffect(() => {
    setSelectedMonth(sharedDate.slice(0, 7));
    setSelectedYear(sharedDate.slice(0, 4));
  }, [sharedDate]);

  const handleSaveRemark = async () => {
    setIsSavingRemark(true);
    await fetch('/api/config/remark', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ remark: newRemark })
    });
    setIsSavingRemark(false);
    setShowRemarkInput(false);
  };

  const years = Array.from({ length: 16 }, (_, i) => (2020 + i).toString());

  useEffect(() => {
    if (selectedClass) {
      const endpoint = reportType === 'monthly' 
        ? `/api/reports/${selectedClass.id}/${selectedMonth}` 
        : `/api/reports/yearly/${selectedClass.id}/${selectedYear}`;
      fetch(endpoint).then(res => res.json()).then(setReport);
    }
  }, [selectedClass, selectedMonth, selectedYear, reportType]);

  const handleExportPDF = () => {
    if (!selectedClass) return;
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text('Attendance Report', 14, 22);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Class: ${selectedClass.name} - Section ${selectedClass.section}`, 14, 30);
    doc.text(`Period: ${reportType === 'monthly' ? selectedMonth : selectedYear}`, 14, 38);
    
    const tableData = report.map(item => [
      item.name,
      item.presentCount.toString(),
      item.absentCount.toString(),
      `${item.percentage}%`
    ]);

    autoTable(doc, {
      head: [['Student Name', 'Present', 'Absent', 'Percentage']],
      body: tableData,
      startY: 45,
      theme: 'striped',
      headStyles: { fillColor: [79, 70, 229] }, // indigo-600
    });

    doc.save(`Attendance_Report_${selectedClass.name}_${reportType === 'monthly' ? selectedMonth : selectedYear}.pdf`);
  };

  // Group classes by name
  const classGroups = classes.reduce((acc: any, curr: any) => {
    if (!acc[curr.name]) acc[curr.name] = [];
    acc[curr.name].push(curr);
    return acc;
  }, {});

  const classNames = Object.keys(classGroups);

  const handleClassSelect = (name: string) => {
    const sections = classGroups[name];
    if (sections.length === 1) {
      setSelectedClass(sections[0]);
    }
    setSelectedClassName(name);
  };

  if (!selectedClassName) {
    return (
      <div className="space-y-6">
        <div className="bg-slate-900 p-6 rounded-3xl text-white shadow-xl shadow-slate-200 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-6 opacity-10">
            <Shield size={80} />
          </div>
          <div className="relative z-10 flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold mb-1">Principal Dashboard</h2>
              <p className="text-slate-400 text-sm">Select a class to view school-wide statistics.</p>
            </div>
            <button 
              onClick={() => setShowRemarkInput(!showRemarkInput)}
              className="p-3 bg-white/10 hover:bg-white/20 rounded-2xl backdrop-blur-sm transition-all border border-white/10"
            >
              <MessageSquare size={20} />
            </button>
          </div>

          <AnimatePresence>
            {showRemarkInput && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="mt-6 pt-6 border-t border-white/10 overflow-hidden"
              >
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Add Remark for Teachers</label>
                <div className="flex gap-2 p-0.5">
                  <input 
                    type="text" 
                    value={newRemark}
                    onChange={(e) => setNewRemark(e.target.value)}
                    placeholder="Type a message for all teachers..."
                    className="flex-1 bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
                  />
                  <button 
                    onClick={handleSaveRemark}
                    disabled={isSavingRemark}
                    className="bg-indigo-600 hover:bg-indigo-700 p-3 rounded-xl transition-all disabled:opacity-50"
                  >
                    <Send size={20} />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {classNames.map((name: string) => (
            <button 
              key={name}
              onClick={() => handleClassSelect(name)}
              className="bg-white p-5 rounded-2xl border border-slate-200 flex items-center justify-between hover:border-indigo-500 hover:bg-slate-50 transition-all group"
            >
              <div className="flex items-center gap-4">
                <ClassIcon />
                <span className="font-bold text-lg text-slate-700">{name}</span>
              </div>
              <ChevronRight size={20} className="text-slate-300" />
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (selectedClassName && !selectedClass) {
    const sections = classGroups[selectedClassName];
    return (
      <div className="space-y-6 min-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between">
          <button onClick={() => setSelectedClassName(null)} className="text-slate-400 hover:text-indigo-600 flex items-center gap-1 text-sm font-medium transition-colors">
            <ChevronLeft size={16} /> Back to Classes
          </button>
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-xl shadow-slate-200/50 relative overflow-hidden"
        >
          <div className="absolute -top-12 -right-12 w-40 h-40 bg-indigo-50 rounded-full blur-3xl opacity-50" />
          
          <div className="relative z-10">
            <h2 className="text-4xl font-black text-slate-900 mb-2">{selectedClassName}</h2>
            <p className="text-slate-400 text-sm mb-8">Choose a section to view detailed attendance reports and student performance.</p>
            
            <div className="grid grid-cols-2 gap-4">
              {sections.map((cls: any) => (
                <button
                  key={cls.id}
                  onClick={() => setSelectedClass(cls)}
                  className="group relative p-8 bg-slate-50 border border-slate-100 rounded-3xl transition-all hover:bg-indigo-600 hover:border-indigo-600 hover:shadow-2xl hover:shadow-indigo-200 hover:-translate-y-1 active:scale-95 overflow-hidden"
                >
                  <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-20 transition-opacity">
                    <Users size={64} />
                  </div>
                  <div className="relative z-10">
                    <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 group-hover:text-indigo-200 mb-1">Section</div>
                    <div className="text-5xl font-black text-slate-700 group-hover:text-white">{cls.section}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex-1 bg-slate-900 rounded-[2.5rem] p-8 text-white relative overflow-hidden shadow-2xl shadow-slate-900/20"
        >
          <div className="absolute bottom-0 right-0 p-8 opacity-10">
            <BarChart3 size={120} />
          </div>
          
          <div className="relative z-10 h-full flex flex-col">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center">
                <Shield size={16} />
              </div>
              <h3 className="font-bold text-lg">Class Insights</h3>
            </div>
            
            <div className="space-y-6 flex-1">
              <div className="grid grid-cols-1 gap-4">
                <div className="p-4 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-sm">
                  <div className="text-[10px] font-black uppercase tracking-widest text-indigo-400 mb-1">Status</div>
                  <p className="text-sm text-slate-300">All data for {selectedClassName} is synced and secured. Reports are updated in real-time as teachers mark attendance.</p>
                </div>
                
                <div className="p-4 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-sm">
                  <div className="text-[10px] font-black uppercase tracking-widest text-emerald-400 mb-1">Tip</div>
                  <p className="text-sm text-slate-300">You can switch between Monthly and Yearly views once you select a section above.</p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button 
          onClick={() => {
            const sections = classGroups[selectedClassName!];
            if (sections.length === 1) {
              setSelectedClassName(null);
            }
            setSelectedClass(null);
          }} 
          className="text-slate-400 hover:text-indigo-600 flex items-center gap-1 text-sm font-medium"
        >
          <ChevronLeft size={16} /> {classGroups[selectedClassName!]?.length === 1 ? 'Back to Classes' : 'Back to Sections'}
        </button>
        <h2 className="font-bold text-slate-900">{selectedClass.name} {classGroups[selectedClassName!]?.length > 1 ? `- ${selectedClass.section}` : ''}</h2>
      </div>

      <div className="flex bg-white p-1 rounded-2xl border border-slate-200 shadow-sm mb-2">
        <button 
          onClick={() => setReportType('monthly')}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${reportType === 'monthly' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
        >
          Monthly
        </button>
        <button 
          onClick={() => setReportType('yearly')}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${reportType === 'yearly' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
        >
          Annual
        </button>
      </div>

      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            {reportType === 'monthly' ? 'Select Month' : 'Select Year'}
          </span>
          {reportType === 'monthly' ? (
            <input 
              type="month" 
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="font-bold text-indigo-900 outline-none bg-transparent"
            />
          ) : (
            <select 
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="font-bold text-indigo-900 outline-none bg-transparent appearance-none"
            >
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          )}
        </div>
        <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-600">
          <Calendar size={20} />
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Monthly Report Summary</h3>
          <div className="flex items-center gap-3">
            <button 
              onClick={handleExportPDF}
              disabled={report.length === 0}
              className="text-xs font-bold text-indigo-600 hover:underline disabled:opacity-50"
            >
              Export PDF
            </button>
          </div>
        </div>

        {report.length === 0 || report.every(item => item.presentCount + item.absentCount === 0) ? (
          <div className="bg-white p-12 rounded-3xl border border-dashed border-slate-300 text-center">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Calendar size={32} className="text-slate-300" />
            </div>
            <p className="text-slate-400 text-sm font-bold uppercase tracking-widest">No Data Available</p>
            <p className="text-slate-300 text-xs mt-1">Attendance hasn't been marked for this period.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {report.map(item => {
              const hasData = item.presentCount + item.absentCount > 0;
              return (
                <div key={item.id} className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <StudentAvatar hasData={hasData} percentage={item.percentage} />
                      <div>
                        <h4 className="font-bold text-slate-800">{item.name}</h4>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                          {hasData ? `${item.presentCount}P / ${item.absentCount}A` : 'No Records'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-lg font-black ${!hasData ? 'text-slate-300' : item.percentage >= 75 ? 'text-emerald-500' : item.percentage >= 50 ? 'text-amber-500' : 'text-rose-500'}`}>
                        {hasData ? `${item.percentage}%` : 'N/A'}
                      </div>
                      <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden mt-1">
                        <div 
                          className={`h-full rounded-full ${!hasData ? 'bg-slate-200' : item.percentage >= 75 ? 'bg-emerald-500' : item.percentage >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`}
                          style={{ width: `${hasData ? item.percentage : 0}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
