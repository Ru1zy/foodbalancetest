"use client";

export default function MorphingShapes() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
      <svg className="absolute w-full h-full" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="gradient1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style={{ stopColor: "#6366f1", stopOpacity: 0.3 }} />
            <stop offset="100%" style={{ stopColor: "#a855f7", stopOpacity: 0.3 }} />
          </linearGradient>
          <linearGradient id="gradient2" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style={{ stopColor: "#ec4899", stopOpacity: 0.3 }} />
            <stop offset="100%" style={{ stopColor: "#f59e0b", stopOpacity: 0.3 }} />
          </linearGradient>
        </defs>

        {/* Morphing blob 1 */}
        <path fill="url(#gradient1)" className="opacity-30">
          <animate
            attributeName="d"
            dur="20s"
            repeatCount="indefinite"
            values="
              M100,200 Q200,100 300,200 T500,200 Q600,300 500,400 T300,400 Q200,300 100,200;
              M100,250 Q250,150 350,250 T550,250 Q650,350 550,450 T350,450 Q250,350 100,250;
              M150,200 Q250,100 350,200 T550,200 Q650,300 550,400 T350,400 Q250,300 150,200;
              M100,200 Q200,100 300,200 T500,200 Q600,300 500,400 T300,400 Q200,300 100,200
            "
          />
        </path>

        {/* Morphing blob 2 */}
        <path fill="url(#gradient2)" className="opacity-20">
          <animate
            attributeName="d"
            dur="15s"
            repeatCount="indefinite"
            values="
              M800,300 Q900,200 1000,300 T1200,300 Q1300,400 1200,500 T1000,500 Q900,400 800,300;
              M850,350 Q950,250 1050,350 T1250,350 Q1350,450 1250,550 T1050,550 Q950,450 850,350;
              M800,300 Q900,200 1000,300 T1200,300 Q1300,400 1200,500 T1000,500 Q900,400 800,300
            "
          />
        </path>
      </svg>
    </div>
  );
}
