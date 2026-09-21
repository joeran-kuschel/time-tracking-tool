function ErrorMessage({ message, id }) {
  if (!message) return null
  return <p id={id} role="alert" className="text-sm text-red-700">{message}</p>
}

export default ErrorMessage
