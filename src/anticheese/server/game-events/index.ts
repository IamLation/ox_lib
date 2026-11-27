import { onGameEvent } from "./rate-limit";

onGameEvent("respawnPlayerPedEvent", { perSecond: 2, burst: 4 });
onGameEvent("ptFxEvent", { perSecond: 30, burst: 60 });
onGameEvent("explosionEvent", { perSecond: 10, burst: 20 });
onGameEvent("fireEvent", { perSecond: 10, burst: 20 });
