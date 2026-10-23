STEEL SWARM — GitHub Pages + Railway

ARCHIVOS PARA SUBIR A ColliTech/collitech.es
- Reemplaza index.html por el de este paquete.
- Añade config.js.
- Añade server.js y package.json en la raíz para que Railway pueda desplegar el servidor.
- Conserva el CNAME existente con el texto collitech.es. Si GitHub advierte que ya existe, no lo reemplaces si contiene lo mismo.
- .gitignore es opcional.

IMPORTANTE: hasta que el servidor se despliegue en Railway, el juego individual funcionará en GitHub Pages, pero el multijugador online mostrará que falta configurar el servidor.

DESPUÉS DE DESPLEGAR EN RAILWAY
1. Copia la URL pública, por ejemplo https://nombre-del-servicio.up.railway.app.
2. En GitHub abre config.js > Edit (lápiz).
3. Cambia window.STEEL_SWARM_SERVER_URL = ''; por window.STEEL_SWARM_SERVER_URL = 'https://TU-SERVICIO.up.railway.app';
4. Commit changes.
5. Comprueba la URL de Railway añadiendo /health; debe responder con ok:true.

El backend usa npm start y el puerto process.env.PORT que proporciona Railway. No subas contraseñas, tokens, claves ni archivos .env.
