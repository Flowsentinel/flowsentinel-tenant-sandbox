export function validatePassword(password) {
  const errors = []
  if (!password || password.length < 12)
    errors.push('At least 12 characters')
  if (!/[A-Z]/.test(password))
    errors.push('At least one uppercase letter')
  if (!/[a-z]/.test(password))
    errors.push('At least one lowercase letter')
  if (!/[0-9]/.test(password))
    errors.push('At least one number')
  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password))
    errors.push('At least one special character')
  return errors
}

export function isPasswordValid(password) {
  return validatePassword(password).length === 0
}

export function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}
