import {Header,Footer} from '@/components/shell';
import {Consent} from '@/components/consent';
import {isProductionSite} from '@/lib/config';
export const dynamic='force-dynamic';
export default function PublicLayout({children}:{children:React.ReactNode}){return <><Header/>{children}<Footer/><Consent enabled={isProductionSite()} measurementId={process.env.GA4_MEASUREMENT_ID}/></>}
