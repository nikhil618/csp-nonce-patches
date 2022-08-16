import { NgModule } from '@angular/core';
import { CustomDomSharedStylesHost } from './shared_styles_host';
import { ɵDomSharedStylesHost, ɵDomRendererFactory2 } from '@angular/platform-browser';
import { MediaMatcher } from '@angular/cdk/layout';
import { CustomMediaMatcher } from './media-matcher';
import { CustomDomRenderer } from './customDomRendererFactory2';

@NgModule({
  providers: [
    { provide: 'cspMetaSelector', useValue: 'meta[name="CSP-NONCE"]' },
    { provide: ɵDomSharedStylesHost, useClass: CustomDomSharedStylesHost },
    { provide: ɵDomRendererFactory2, useClass: CustomDomRenderer },
    { provide: MediaMatcher, useClass: CustomMediaMatcher}
  ],
})
export class InlineStylesCSPModule {}