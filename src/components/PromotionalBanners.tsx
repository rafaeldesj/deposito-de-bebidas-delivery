import { useState, useEffect } from 'react';

const BANNERS = [
  { id: 1, title: '🍺 Cervejas estupidamente geladas!', subtitle: 'Peça e receba em até 30 minutos na sua casa.', bg: 'linear-gradient(135deg, #FFD100 0%, #FFA800 100%)', color: '#121212' },
  { id: 2, title: '🥃 Destilados Importados & Nacionais', subtitle: 'Até 15% OFF na sua primeira compra usando cupom DEPO15.', bg: 'linear-gradient(135deg, #1E1E1E 0%, #2A2A2A 100%)', color: '#FFFFFF', border: '1px solid rgba(255, 209, 0, 0.3)' },
  { id: 3, title: '🧊 Gelo e Carvão para o Churrasco!', subtitle: 'Tudo pronto para o seu churrasco de fim de semana.', bg: 'linear-gradient(135deg, #00C6FF 0%, #0072FF 100%)', color: '#FFFFFF' }
];

export const PromotionalBanners = () => {
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide(prev => (prev + 1) % BANNERS.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ position: 'relative', width: '100%', height: '130px', borderRadius: '12px', overflow: 'hidden', marginBottom: '1.5rem', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>
      {BANNERS.map((slide, index) => (
        <div
          key={slide.id}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: slide.bg,
            color: slide.color,
            border: slide.border || 'none',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            padding: '1.5rem',
            boxSizing: 'border-box',
            opacity: currentSlide === index ? 1 : 0,
            transition: 'opacity 0.6s ease-in-out',
            zIndex: currentSlide === index ? 1 : 0
          }}
        >
          <h3 style={{ margin: '0 0 0.3rem 0', fontSize: '1.3rem', fontWeight: 800, color: slide.color }}>{slide.title}</h3>
          <p style={{ margin: 0, fontSize: '0.85rem', opacity: 0.9 }}>{slide.subtitle}</p>
        </div>
      ))}
      <div style={{ position: 'absolute', bottom: '10px', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '8px', zIndex: 2 }}>
        {BANNERS.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentSlide(index)}
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: currentSlide === index ? 'var(--primary-gold)' : 'rgba(255,255,255,0.4)',
              border: 'none',
              cursor: 'pointer',
              padding: 0
            }}
          />
        ))}
      </div>
    </div>
  );
};
