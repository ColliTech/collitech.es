STEEL SWARM — estructura organizada para GitHub Pages + Railway

ESTRUCTURA DEL REPOSITORIO
- En la raíz: index.html, config.js y CNAME. GitHub Pages publica la web desde la raíz.
- En /server: server.js y package.json. Railway ejecutará el backend desde /server.

SUBIDA A GITHUB
1. Conserva el CNAME que ya existe si contiene collitech.es.
2. Sustituye el index.html de la raíz por el de este paquete y añade/reemplaza config.js.
3. Crea la carpeta server y sube dentro server/server.js y server/package.json.
4. Si antes subiste server.js y package.json a la raíz, bórralos después de confirmar que los equivalentes existen en /server. No borres CNAME.
5. Conserva tus páginas antiguas por ahora; no interfieren con index.html, aunque puedes moverlas luego a /web-antigua si no las necesitas.

RAILWAY
1. Conecta Railway al repositorio ColliTech/collitech.es.
2. En Settings del servicio, configura Root Directory como /server.
3. Start command: npm start. El proyecto usa process.env.PORT.
4. Genera un dominio público HTTPS. La ruta /health debe responder JSON con ok:true.
5. Copia esa URL al archivo config.js, en window.STEEL_SWARM_SERVER_URL, y haz commit.

IMPORTANTE
Hasta que se configure una URL válida del backend, el modo individual de la web puede abrirse, pero el multijugador online no conectará. No subas secretos, tokens ni archivos .env.
