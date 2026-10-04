function WhatsApp() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="16" r="15" fill="#25d366" />
      <path
        d="M16 7.2a8.7 8.7 0 0 0-7.5 13.1L7.2 24.8l4.6-1.2A8.7 8.7 0 1 0 16 7.2Zm0 15.9a7.2 7.2 0 0 1-3.7-1l-.3-.2-2.7.7.7-2.6-.2-.3A7.2 7.2 0 1 1 16 23.1Zm4-5.4c-.2-.1-1.3-.7-1.5-.7s-.4-.1-.5.1l-.7.9c-.1.2-.3.2-.5.1a5.9 5.9 0 0 1-2.9-2.5c-.2-.4.2-.4.6-1.2.1-.1 0-.3 0-.4l-.7-1.6c-.2-.4-.3-.4-.5-.4h-.4a.8.8 0 0 0-.6.3 2.5 2.5 0 0 0-.8 1.9c0 1.1.8 2.2.9 2.3.1.2 1.6 2.5 3.9 3.5 1.4.6 2 .7 2.7.6.4-.1 1.3-.5 1.5-1.1s.2-1 .1-1.1-.2-.2-.5-.3Z"
        fill="#fff"
      />
    </svg>
  );
}

/** Bloque "Domicilios + teléfonos" de las portadas (valores editables en la configuración del negocio). */
export default function Contact({ phone1, phone2 }: { phone1: string; phone2: string }) {
  return (
    <div className="contact" data-testid="contact">
      <div className="label">Domicilios</div>
      {[phone1, phone2]
        .filter(Boolean)
        .map((p) => (
          <div className="phone" key={p}>
            <WhatsApp />
            <span>{p}</span>
          </div>
        ))}
    </div>
  );
}
