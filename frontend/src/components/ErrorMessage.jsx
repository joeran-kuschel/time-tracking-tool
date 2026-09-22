function ErrorMessage({ message, id }) {
  if (!message) return null
  return <p id={id} role="alert" className="text-sm text-danger">{message}</p>
}

export default ErrorMessage
