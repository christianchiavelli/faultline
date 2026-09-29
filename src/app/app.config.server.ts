import { HttpBackend } from '@angular/common/http';
import { mergeApplicationConfig, type ApplicationConfig } from '@angular/core';
import { provideServerRendering, withRoutes } from '@angular/ssr';
import { appConfig } from './app.config';
import { serverRoutes } from './app.routes.server';
import { InProcessApiBackend } from './core/api/in-process-backend';

const serverConfig: ApplicationConfig = {
  providers: [
    provideServerRendering(withRoutes(serverRoutes)),
    // Declared after the browser config, so it replaces the fetch backend for this platform only.
    { provide: HttpBackend, useClass: InProcessApiBackend },
  ],
};

export const config = mergeApplicationConfig(appConfig, serverConfig);
