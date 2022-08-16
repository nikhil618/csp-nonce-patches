import { APP_ID, Inject, Injectable, Renderer2, RendererStyleFlags2 } from "@angular/core";
import { EventManager, ɵDomRendererFactory2, ɵDomSharedStylesHost } from '@angular/platform-browser';
import { environment } from "../../environments/environment";
import { CustomDomSharedStylesHost } from "./shared_styles_host";

// Patch to support Nonce with external libraries that have inline styles
const NG_DEV_MODE = environment.production;

const classList = new Map<string, string>();
let styleSheet = document.getElementById('__dyn__') as HTMLStyleElement;

export const NAMESPACE_URIS: { [ns: string]: string } = {
    'svg': 'http://www.w3.org/2000/svg',
    'xhtml': 'http://www.w3.org/1999/xhtml',
    'xlink': 'http://www.w3.org/1999/xlink',
    'xml': 'http://www.w3.org/XML/1998/namespace',
    'xmlns': 'http://www.w3.org/2000/xmlns/',
    'math': 'http://www.w3.org/1998/MathML/',
};


@Injectable()
// @ts-ignore
export class CustomDomRenderer extends ɵDomRendererFactory2 {
    override defaultRenderer: Renderer2;
    constructor(
        eventManager: EventManager, sharedStylesHost: ɵDomSharedStylesHost,
        @Inject(APP_ID) appId: string, @Inject(ɵDomSharedStylesHost) private customDomSharedStylesHost: CustomDomSharedStylesHost) {
        super(eventManager, sharedStylesHost, appId);
        this.defaultRenderer = new CustomDefaultDomRenderer2(eventManager);
        styleSheet = styleSheet || document.createElement('style');
        styleSheet.setAttribute('id', '__dyn__');
        if (customDomSharedStylesHost.nonce) {
            styleSheet.setAttribute('nonce', customDomSharedStylesHost.nonce)
        }
        document.head.appendChild(styleSheet);
    }
}

class CustomDefaultDomRenderer2 extends Renderer2 {
    data: { [key: string]: any } = Object.create(null);

    constructor(private eventManager: EventManager,) {
        super();
    }

    destroy(): void { }

    override destroyNode = null;

    createElement(name: string, namespace?: string): any {
        if (namespace) {
            // TODO: `|| namespace` was added in
            // https://github.com/angular/angular/commit/2b9cc8503d48173492c29f5a271b61126104fbdb to
            // support how Ivy passed around the namespace URI rather than short name at the time. It did
            // not, however extend the support to other parts of the system (setAttribute, setAttribute,
            // and the ServerRenderer). We should decide what exactly the semantics for dealing with
            // namespaces should be and make it consistent.
            // Related issues:
            // https://github.com/angular/angular/issues/44028
            // https://github.com/angular/angular/issues/44883
            return document.createElementNS(NAMESPACE_URIS[namespace] || namespace, name);
        }

        return document.createElement(name);
    }

    createComment(value: string): any {
        return document.createComment(value);
    }

    createText(value: string): any {
        return document.createTextNode(value);
    }

    appendChild(parent: any, newChild: any): void {
        const targetParent = isTemplateNode(parent) ? parent.content : parent;
        targetParent.appendChild(newChild);
    }

    insertBefore(parent: any, newChild: any, refChild: any): void {
        if (parent) {
            const targetParent = isTemplateNode(parent) ? parent.content : parent;
            targetParent.insertBefore(newChild, refChild);
        }
    }

    removeChild(parent: any, oldChild: any): void {
        if (parent) {
            parent.removeChild(oldChild);
        }
    }

    selectRootElement(selectorOrNode: string | any, preserveContent?: boolean): any {
        let el: any = typeof selectorOrNode === 'string' ? document.querySelector(selectorOrNode) :
            selectorOrNode;
        if (!el) {
            throw new Error(`The selector "${selectorOrNode}" did not match any elements`);
        }
        if (!preserveContent) {
            el.textContent = '';
        }
        return el;
    }

    parentNode(node: any): any {
        return node.parentNode;
    }

    nextSibling(node: any): any {
        return node.nextSibling;
    }

    setAttribute(el: any, name: string, value: string, namespace?: string): void {
        if (namespace) {
            name = namespace + ':' + name;
            const namespaceUri = NAMESPACE_URIS[namespace];
            if (namespaceUri) {
                el.setAttributeNS(namespaceUri, name, value);
            } else {
                el.setAttribute(name, value);
            }
        } else if (name === "style") {
            const existingName = getByValue(classList, value);
            const className = existingName || 'dyn_' + randomClassGenerator();
            if (styleSheet && !existingName) {
                classList.set(className, value);
                // TODO: inline styles have higher specificity so use !important for ${value} below
                styleSheet.innerHTML += `.${className} { ${value} }`;
            }
            console.log(className);
            el.classList.add(className);
        } else {
            el.setAttribute(name, value);
        }
    }

    removeAttribute(el: any, name: string, namespace?: string): void {
        if (namespace) {
            const namespaceUri = NAMESPACE_URIS[namespace];
            if (namespaceUri) {
                el.removeAttributeNS(namespaceUri, name);
            } else {
                el.removeAttribute(`${namespace}:${name}`);
            }
        } else {
            el.removeAttribute(name);
        }
    }

    addClass(el: any, name: string): void {
        el.classList.add(name);
    }

    removeClass(el: any, name: string): void {
        el.classList.remove(name);
    }

    setStyle(el: any, style: string, value: any, flags: RendererStyleFlags2): void {
        if (flags & (RendererStyleFlags2.DashCase | RendererStyleFlags2.Important)) {
            el.style.setProperty(style, value, flags & RendererStyleFlags2.Important ? 'important' : '');
        } else {
            el.style[style] = value;
        }
    }

    removeStyle(el: any, style: string, flags: RendererStyleFlags2): void {
        if (flags & RendererStyleFlags2.DashCase) {
            el.style.removeProperty(style);
        } else {
            // IE requires '' instead of null
            // see https://github.com/angular/angular/issues/7916
            el.style[style] = '';
        }
    }

    setProperty(el: any, name: string, value: any): void {
        NG_DEV_MODE && checkNoSyntheticProp(name, 'property');
        el[name] = value;
    }

    setValue(node: any, value: string): void {
        node.nodeValue = value;
    }

    listen(target: 'window' | 'document' | 'body' | any, event: string, callback: (event: any) => boolean):
        () => void {
        NG_DEV_MODE && checkNoSyntheticProp(event, 'listener');
        if (typeof target === 'string') {
            return <() => void>this.eventManager.addGlobalEventListener(
                target, event, decoratePreventDefault(callback));
        }
        return <() => void>this.eventManager.addEventListener(
            target, event, decoratePreventDefault(callback)) as () => void;
    }
}

const AT_CHARCODE = (() => '@'.charCodeAt(0))();
function checkNoSyntheticProp(name: string, nameKind: string) {
    if (name.charCodeAt(0) === AT_CHARCODE) {
        throw new Error(`Unexpected synthetic ${nameKind} ${name} found. Please make sure that:
  - Either \`BrowserAnimationsModule\` or \`NoopAnimationsModule\` are imported in your application.
  - There is corresponding configuration for the animation named \`${name}\` defined in the \`animations\` field of the \`@Component\` decorator (see https://angular.io/api/core/Component#animations).`);
    }
}

function isTemplateNode(node: any): node is HTMLTemplateElement {
    return node.tagName === 'TEMPLATE' && node.content !== undefined;
}

function decoratePreventDefault(eventHandler: Function): Function {
    // `DebugNode.triggerEventHandler` needs to know if the listener was created with
    // decoratePreventDefault or is a listener added outside the Angular context so it can handle the
    // two differently. In the first case, the special '__ngUnwrap__' token is passed to the unwrap
    // the listener (see below).
    return (event: any) => {
        // Ivy uses '__ngUnwrap__' as a special token that allows us to unwrap the function
        // so that it can be invoked programmatically by `DebugNode.triggerEventHandler`. The debug_node
        // can inspect the listener toString contents for the existence of this special token. Because
        // the token is a string literal, it is ensured to not be modified by compiled code.
        if (event === '__ngUnwrap__') {
            return eventHandler;
        }

        const allowDefaultBehavior = eventHandler(event);
        if (allowDefaultBehavior === false) {
            // TODO(tbosch): move preventDefault into event plugins...
            event.preventDefault();
            event.returnValue = false;
        }

        return undefined;
    };
}

function randomClassGenerator(length = 6) {
    let result = '';
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    const charactersLength = characters.length;
    for (let i = 0; i < length ; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}

function getByValue(map: Map<string, string>, searchValue: string) {
    for (let [key, value] of map.entries()) {
      if (value === searchValue)
        return key;
    }
    return false;
  }