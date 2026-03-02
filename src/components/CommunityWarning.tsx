// HealthVault — Community provider warning banner (shared)

export default function CommunityWarning() {
  return (
    <div className="bg-amber-900/30 border border-amber-700/40 rounded-lg p-3 space-y-2">
      <p className="text-xs text-amber-300 leading-relaxed">
        <span className="font-semibold">Note:</span> The Community provider
        routes your queries through a private Azure OpenAI resource. Your
        conversations (including health context) are sent to this service for
        processing. No data is stored on the server.
      </p>
      <ul className="text-xs text-amber-400/80 list-disc list-inside space-y-0.5">
        <li>Rate limit: 10–20 requests per hour per IP</li>
        <li>Request size limit: 4 MB (including images)</li>
      </ul>
    </div>
  );
}
