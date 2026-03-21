module.exports = {
    apps: [{
        name: "insta-bot-server",
        script: "src/instagram-api-server.js",
        env: {
            NODE_ENV: "production",
            PORT: 3001, // Forçando a porta correta
            RAPIDAPI_KEY: process.env.RAPIDAPI_KEY,
            RAPIDAPI_HOST: "instagram-scraper-stable-api.p.rapidapi.com"
        },
        // Reiniciar se memória > 500MB
        max_memory_restart: "500M",
        // Log formatado
        log_date_format: "YYYY-MM-DD HH:mm Z"
    }, {
        name: "insta-bot-tunnel",
        script: "./start-tunnel-pm2.sh",
        interpreter: "bash",
        // Reiniciar sempre se cair
        autorestart: true,
        watch: false
    }]
}
