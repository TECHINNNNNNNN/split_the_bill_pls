import "dotenv/config";
import { serve } from "@hono/node-server";
import app from "./app.js"

const port = 3001;

serve({ fetch: app.fetch, port, hostname: "0.0.0.0" }, () => {
    console.log(`
\x1b[36m    ⢀⣠⣤⣤⣀⣀⡀
⢀⡼⠋⠁⣠⣄⡀⠈⢹⡗⢦⣤⠶⠛⢳⡄
⢸⠁⠀⠘⣧⣨⠇⠀⣸⠁⠀⠈⠳⣄⠀⠹⡆       \x1b[1m\x1b[33m━━━ 🐟 PLADUK KHLONG TOEI v0.0.0 ━━━\x1b[0m
\x1b[36m⢸⡓⠶⠆⠀⠀⠀⣰⠋⠀⢀⡿⠀⠘⢧⡀⠹⣆\x1b[0m\x1b[2m      ว้ายตายแล้วค้าบ สักปลาคราฟมึงได้ปลาดุกคลองเตย\x1b[0m
\x1b[36m⠘⣧⣀⣀⣠⡴⠞⠁⠀⠙⠉⠀⠀⡆⠈⢧⠀⢙⡆
⠀⠘⣏⠁⠀⠀⢀⡿⠀⠀⠀⠒⠚⠁⠀⢸⡟⠋\x1b[0m\x1b[32m       [✅] Bill-splitting engine \x1b[2m.................. loaded\x1b[0m
\x1b[36m⠀⠀⠙⣦⠀⠐⠚⠃⠀⢰⡆⠀⠀⣴⠀⠈⣧⣀\x1b[0m\x1b[32m     [✅] "เดี๋ยวโอนให้" detector \x1b[2m................ armed\x1b[0m
\x1b[36m⠀⠀⠀⠈⠳⢦⣀⠐⠛⠋⠀⠐⠒⠋⠀⢀⡀⠉⠙⠓⢲⡄\x1b[0m\x1b[32m [✅] แอบหนีตอนจ่ายบิล radar \x1b[2m.............. active\x1b[0m
\x1b[36m⠀⠀⠀⠀⠀⠀⠉⠓⠶⠤⣤⣤⡀⠀⢤⠈⠙⠓⠀⠀⣠⡇\x1b[0m\x1b[32m [✅] PromptPay QR generator \x1b[2m............... ready\x1b[0m
\x1b[36m⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢹⡄⠈⠓⠀⣠⠖⠋⠁\x1b[0m\x1b[32m   [✅] ฝากจ่ายก่อนนะ deflector shield \x1b[2m..... online\x1b[0m
\x1b[36m⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣧⠀⠀⣰⠏\x1b[0m
\x1b[36m⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⠛⠚⠁\x1b[0m\x1b[1m\x1b[32m       >> Server swimming at http://localhost:${port}\x1b[0m
\x1b[35m       💔 หารบิลไม่หารใจ\x1b[0m
`)
})