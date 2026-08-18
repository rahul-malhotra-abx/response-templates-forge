import EventEmitter from "events";

export class IframeDataModel extends EventEmitter {
    constructor(attributes: any = {}) {
        super();
        Object.assign(this.attributes, attributes);
    }



    attributes: any = {};

    setAttribute(prop: string, value: any): this {
        this.attributes[prop] = value;
        return this;
    }

    getAttribute(prop: string): any {
        return this.attributes[prop];
    }

    getSysProps() {
        const {innerWidth: width, innerHeight: height} = window;
        return {height, width};
    }
}
