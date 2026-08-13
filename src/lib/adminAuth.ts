/**
 * Admin 2-Layer Security Module
 * Layer 1: Firebase Auth Email matching VITE_ADMIN_EMAIL
 * Layer 2: Secret PIN verification matching VITE_ADMIN_PIN
 */

export const getAdminEmail = (): string => {
  return (import.meta.env.VITE_ADMIN_EMAIL || 'nhuochy259@gmail.com').trim().toLowerCase();
};

export const getAdminPin = (): string => {
  return (import.meta.env.VITE_ADMIN_PIN || '').trim();
};

/**
 * Layer 1 Check: Verify if user's logged-in email matches VITE_ADMIN_EMAIL
 */
export const isUserAdminEmail = (userEmail?: string | null): boolean => {
  if (!userEmail) return false;
  const targetEmail = getAdminEmail();
  return userEmail.trim().toLowerCase() === targetEmail;
};

/**
 * Check if PIN has been verified in current browser session
 */
export const isAdminPinVerified = (): boolean => {
  try {
    return sessionStorage.getItem('admin_pin_verified') === 'true';
  } catch (e) {
    return false;
  }
};

/**
 * Update PIN verification state for current session
 */
export const setAdminPinVerified = (verified: boolean): void => {
  try {
    if (verified) {
      sessionStorage.setItem('admin_pin_verified', 'true');
    } else {
      sessionStorage.removeItem('admin_pin_verified');
    }
  } catch (e) {
    console.error('Failed to update admin PIN verification state:', e);
  }
};

/**
 * Layer 2 Check: Compare user input PIN with VITE_ADMIN_PIN environment variable
 */
export const verifyAdminPin = (inputPin: string): { success: boolean; error?: string } => {
  const secretPin = getAdminPin();
  
  if (!secretPin) {
    return { 
      success: false, 
      error: 'Biến môi trường VITE_ADMIN_PIN chưa được cấu hình. Vui lòng thiết lập VITE_ADMIN_PIN trên Vercel hoặc .env' 
    };
  }

  if (inputPin.trim() === secretPin) {
    setAdminPinVerified(true);
    return { success: true };
  }

  return { 
    success: false, 
    error: 'Mã PIN bí mật không chính xác. Vui lòng kiểm tra lại.' 
  };
};

/**
 * Check if user satisfies both Layer 1 (Email) and Layer 2 (PIN)
 */
export const isFullAdminUnlocked = (user?: { email?: string | null; role?: string } | null): boolean => {
  if (!user) return false;
  const isEmailMatch = isUserAdminEmail(user.email);
  const isPinUnlocked = isAdminPinVerified();
  return isEmailMatch && isPinUnlocked;
};
