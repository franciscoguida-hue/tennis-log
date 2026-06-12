# 🎾 Tennis Log

App web para registrar y consultar partidos de tenis. Accesible desde móvil y desktop.

## ✨ Funcionalidades

- **Login con usuario + contraseña** — cada usuario ve sus propias estadísticas
- **Historial compartido** — todos los partidos visibles para todos los usuarios
- **Tablero estilo oficial** — fondo oscuro, score set por set, tie-break, indicador de ganador
- **Filtros** — por fecha, jugador, modalidad y resultado
- **Estadísticas personales** — récord W/L general y por rival
- **Ver stats de cualquier jugador** — no solo las propias
- **Exportar CSV** — historial filtrado y stats individuales
- **Soporte Singles y Dobles** — 2 o 4 jugadores por partido
- **Dark mode automático** — respeta la preferencia del sistema

## 🚀 Uso

La app está disponible en: **https://franciscoguida-hue.github.io/tennis-log**

No requiere instalación. Funciona en cualquier navegador moderno, móvil o desktop.

## 🔧 Datos

Los datos se guardan en Firebase Firestore: usuarios y partidos se comparten entre todos los dispositivos en tiempo real.

## 📁 Estructura

```
tennis-log/
└── index.html    # App completa (HTML + CSS + JS autocontenido)
```

## 🛠 Desarrollo

No requiere build ni dependencias. Editá `index.html` directamente.
