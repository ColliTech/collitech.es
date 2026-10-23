STEEL SWARM 3.8 — backend para Railway

DESPLIEGUE
1. Sube el contenido de esta carpeta a un repositorio GitHub nuevo, separado del repositorio GitHub Pages.
2. En Railway, crea un proyecto nuevo y despliega ese repositorio. El comando de inicio es `npm start`; Railway detecta package.json. No configures un puerto fijo: el servidor usa process.env.PORT.
3. Cuando Railway entregue la URL pública, visita https://TU-SERVICIO.up.railway.app/health y comprueba que responde con {"ok":true}.
4. Copia esa URL en github-pages/config.js como window.STEEL_SWARM_SERVER_URL.
5. Si el dominio que usas para la web cambia, define la variable de entorno CORS_ORIGINS con los orígenes separados por coma; ejemplo: https://collitech.es,https://www.collitech.es.

VARIABLES OPCIONALES
- CORS_ORIGINS: lista separada por comas de los orígenes web autorizados. Por defecto incluye collitech.es, www.collitech.es, collitech.github.io y localhost para pruebas.

La plataforma tiene que mantener el proceso Node.js activo. No compartas claves privadas ni tokens.
