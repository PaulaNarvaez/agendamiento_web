import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { configurationReport, missingSettings, organizerConfigurationIssue } from '../configuration.js';

console.log(`Archivo de configuración: ${resolve('.env')}`);
if (!existsSync('.env')) console.log('No existe .env en esta carpeta. Créalo a partir de .env.example sin sobrescribir un archivo existente.');
console.log(configurationReport());
process.exitCode = (missingSettings().length || organizerConfigurationIssue()) ? 1 : 0;
