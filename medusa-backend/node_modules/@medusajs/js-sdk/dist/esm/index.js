import { Admin } from "./admin/index.js";
import { Auth } from "./auth/index.js";
import { Client } from "./client.js";
import { Store } from "./store/index.js";
class Medusa {
    constructor(config) {
        this.client = new Client(config);
        this.admin = new Admin(this.client);
        this.store = new Store(this.client);
        this.auth = new Auth(this.client, config);
    }
    setLocale(locale) {
        this.client.setLocale(locale);
    }
    getLocale() {
        return this.client.locale;
    }
}
export default Medusa;
export { FetchError, Client } from "./client.js";
export { Admin } from "./admin/index.js";
export { Auth, } from "./auth/index.js";
export { Store } from "./store/index.js";
//# sourceMappingURL=index.js.map