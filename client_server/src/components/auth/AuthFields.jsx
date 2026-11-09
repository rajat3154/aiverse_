// Form building blocks shared by the login and signup pages.
export const Field = ({ label, error, children, optional, light }) => (
  <label className="block min-w-0">
    <span className={`mb-1.5 flex items-center justify-between text-xs font-medium ${light ? "text-gray-700" : "text-[#B8C4D0]"}`}>
      {label}
      {optional && <span className={light ? "text-gray-400" : "text-[#5B6B7E]"}>Optional</span>}
    </span>
    {children}
    {error && <span className={`mt-1 block text-xs ${light ? "text-red-600" : "text-red-400"}`}>{error}</span>}
  </label>
);
