
import React, { useState } from 'react'

const GATEWAY_URL = 'https://aiverse-gateway-3je5.onrender.com'

const App = () => {
  const [loading, setLoading] = useState('')
  const [results, setResults] = useState({})

  const testAPI = async (name, endpoint) => {
    setLoading(name)
    setResults(prev => ({ ...prev, [name]: null }))
    try {
      const response = await fetch(`${GATEWAY_URL}${endpoint}`)
      const text = await response.text()
      let data
      try {
        data = JSON.parse(text)
      } catch {
        data = `Non-JSON response (HTTP ${response.status}): ${text.slice(0, 200)}`
      }
      setResults(prev => ({
        ...prev,
        [name]: {
          success: response.ok,
          status: response.status,
          data
        }
      }))
    } catch (error) {
      setResults(prev => ({
        ...prev,
        [name]: {
          success: false,
          error: error.message
        }
      }))
    } finally {
      setLoading('')
    }
  }

  const renderResult = (name, title) => {
    const result = results[name]
    if (!result) return null
    return (
      <div className="w-full rounded-xl border border-gray-700 bg-gray-900 p-5">
        <h2 className="mb-3 text-lg font-semibold">{title}</h2>
        <p className={result.success ? 'text-emerald-400' : 'text-red-400'}>
          {result.success ? 'Connection Successful' : 'Connection Failed'}
        </p>
        {result.status && (
          <p className="mt-2 text-gray-300">HTTP Status: {result.status}</p>
        )}
        <pre className="mt-3 overflow-x-auto rounded-lg bg-gray-950 p-3 text-sm text-gray-300">
          {JSON.stringify(result.data || result.error, null, 2)}
        </pre>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center gap-6 p-6">
      <h1 className="text-4xl font-bold tracking-wider">AIVERSE</h1>
      <div className="flex flex-wrap justify-center gap-4">
        <button
          onClick={() => testAPI('gateway', '/actuator/health')}
          disabled={!!loading}
          className="rounded-lg bg-emerald-500 px-6 py-3 font-semibold text-gray-950 hover:bg-emerald-400 disabled:opacity-50"
        >
          {loading === 'gateway' ? 'Testing...' : 'Test Gateway'}
        </button>
        <button
          onClick={() => testAPI('ai', '/api/v1/ai/health')}
          disabled={!!loading}
          className="rounded-lg bg-cyan-500 px-6 py-3 font-semibold text-gray-950 hover:bg-cyan-400 disabled:opacity-50"
        >
          {loading === 'ai' ? 'Testing...' : 'Test AI Server'}
        </button>
        <button
          onClick={() => testAPI('spring', '/api/v1/identity/health')}
          disabled={!!loading}
          className="rounded-lg bg-violet-500 px-6 py-3 font-semibold text-gray-950 hover:bg-violet-400 disabled:opacity-50"
        >
          {loading === 'spring' ? 'Testing...' : 'Test Spring Server'}
        </button>
        <button
          onClick={() => testAPI('flowable', '/api/v1/workflows/health')}
          disabled={!!loading}
          className="rounded-lg bg-amber-500 px-6 py-3 font-semibold text-gray-950 hover:bg-amber-400 disabled:opacity-50"
        >
          {loading === 'flowable' ? 'Testing...' : 'Test Flowable Server'}
        </button>
      </div>
      <div className="w-full max-w-lg space-y-4">
        {renderResult('gateway', 'Gateway Response')}
        {renderResult('ai', 'AI Server Response (via Gateway)')}
        {renderResult('spring', 'Spring Server Response (via Gateway)')}
        {renderResult('flowable', 'Flowable Server Response (via Gateway)')}
      </div>
    </div>
  )
}

export default App
