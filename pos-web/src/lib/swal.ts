import Swal from 'sweetalert2';

export const showSuccess = (title: string, text?: string) => {
  return Swal.fire({
    title,
    text,
    icon: 'success',
    background: '#0f172a',
    color: '#f8fafc',
    iconColor: '#10b981',
    confirmButtonColor: '#3b82f6',
    customClass: {
      popup: 'border border-slate-700/80 rounded-2xl shadow-2xl backdrop-blur-xl',
      title: 'text-xl font-bold text-white',
      confirmButton: 'px-5 py-2.5 rounded-xl font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-lg shadow-blue-500/25 transition-all'
    }
  });
};

export const showError = (title: string, text?: string) => {
  return Swal.fire({
    title,
    text,
    icon: 'error',
    background: '#0f172a',
    color: '#f8fafc',
    iconColor: '#ef4444',
    confirmButtonColor: '#ef4444',
    customClass: {
      popup: 'border border-slate-700/80 rounded-2xl shadow-2xl backdrop-blur-xl',
      title: 'text-xl font-bold text-white',
      confirmButton: 'px-5 py-2.5 rounded-xl font-semibold bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 shadow-lg shadow-red-500/25 transition-all'
    }
  });
};

export const showInfo = (title: string, text?: string) => {
  return Swal.fire({
    title,
    text,
    icon: 'info',
    background: '#0f172a',
    color: '#f8fafc',
    iconColor: '#38bdf8',
    confirmButtonColor: '#38bdf8',
    customClass: {
      popup: 'border border-slate-700/80 rounded-2xl shadow-2xl backdrop-blur-xl',
      title: 'text-xl font-bold text-white',
      confirmButton: 'px-5 py-2.5 rounded-xl font-semibold bg-gradient-to-r from-sky-600 to-cyan-600 shadow-lg shadow-sky-500/25 transition-all'
    }
  });
};

export const showWarning = (title: string, text?: string) => {
  return Swal.fire({
    title,
    text,
    icon: 'warning',
    background: '#0f172a',
    color: '#f8fafc',
    iconColor: '#f59e0b',
    confirmButtonColor: '#f59e0b',
    customClass: {
      popup: 'border border-slate-700/80 rounded-2xl shadow-2xl backdrop-blur-xl',
      title: 'text-xl font-bold text-white',
      confirmButton: 'px-5 py-2.5 rounded-xl font-semibold bg-gradient-to-r from-amber-600 to-orange-600 shadow-lg shadow-amber-500/25 transition-all'
    }
  });
};

export const showConfirm = async (title: string, text: string, confirmText: string = 'ยืนยัน', cancelText: string = 'ยกเลิก') => {
  const result = await Swal.fire({
    title,
    text,
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: confirmText,
    cancelButtonText: cancelText,
    background: '#0f172a',
    color: '#f8fafc',
    iconColor: '#60a5fa',
    confirmButtonColor: '#3b82f6',
    cancelButtonColor: '#475569',
    customClass: {
      popup: 'border border-slate-700/80 rounded-2xl shadow-2xl backdrop-blur-xl',
      title: 'text-xl font-bold text-white',
      confirmButton: 'px-5 py-2.5 rounded-xl font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 shadow-lg shadow-blue-500/25 transition-all',
      cancelButton: 'px-5 py-2.5 rounded-xl font-semibold bg-slate-700 hover:bg-slate-600 text-slate-200 transition-all'
    }
  });
  return result.isConfirmed;
};

export default Swal;
