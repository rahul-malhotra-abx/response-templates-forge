import EventEmitter from "events";

export class IframeDataModel extends EventEmitter {
    constructor(attributes: any = {}) {
        super();
        Object.assign(this.attributes, attributes);
    }

    /* public avatar: any = {name: '', size: 'medium', src: ''};
     public author: string = '';
     public content: string[] = [`<p>Content goes here. This can include`, `<a href="/link">links</a>`, `and other content.</p>`];
     public edited: boolean = false;
     public commentTime: Date | undefined;
     public restrictedTo: string = 'Restricted to Admins Only';
     public actions: any[] = [];*/


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
