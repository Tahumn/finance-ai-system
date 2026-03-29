import 'i18next'

import { defaultNS } from '@/lib/i18n/settings'

import administrations from './public/locales/en/administrations.json'
import app from './public/locales/en/app.json'
import inventory from './public/locales/en/inventory.json'
import common from './public/locales/en/common.json'
import crm from './public/locales/en/crm.json'
import dashboard from './public/locales/en/dashboard.json'
import invoices from './public/locales/en/invoices.json'
import masterdata from './public/locales/en/masterdata.json'
import menuonlines from './public/locales/en/menuonlines.json'
import notifications from './public/locales/en/notifications.json'
import orders from './public/locales/en/orders.json'
import payment from './public/locales/en/payment.json'
import promotions from './public/locales/en/promotions.json'
import report from './public/locales/en/report.json'
import requests from './public/locales/en/requests.json'
import salesorder from './public/locales/en/salesorder.json'
import sidebar from './public/locales/en/sidebar.json'
import support from './public/locales/en/support.json'
import system from './public/locales/en/system.json'
import workflows from './public/locales/en/workflows.json'
import cs from './public/locales/en/cs.json'
import integrations from './public/locales/en/integrations.json'
declare module 'i18next' {
    interface CustomTypeOptions {
        defaultNS: typeof defaultNS
        resources: {
            common: typeof common
            promotions: typeof promotions
            administrations: typeof administrations
            system: typeof system
            invoices: typeof invoices
            crm: typeof crm
            report: typeof report
            masterdata: typeof masterdata
            orders: typeof orders
            menuonlines: typeof menuonlines
            workflows: typeof workflows
            notifications: typeof notifications
            sidebar: typeof sidebar
            payment: typeof payment
            dashboard: typeof dashboard
            salesorder: typeof salesorder
            requests: typeof requests
            support: typeof support
            app: typeof app
            inventory: typeof inventory
            cs: typeof cs
            integrations: typeof integrations
        }
    }
}
