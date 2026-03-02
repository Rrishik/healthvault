// HealthVault — Community provider warning banner (shared)

export default function CommunityWarning() {
  return (
    <div className="bg-amber-900/30 border border-amber-700/40 rounded-lg p-3">
      <p className="text-xs text-amber-300 leading-relaxed">
        <span className="font-semibold">Note:</span> The Community provider
        routes your queries through a private Azure OpenAI resource. Your
        conversations (including health context) are sent to this service for
        processing. No data is stored on the server.
      </p>
    </div>
  );
}
