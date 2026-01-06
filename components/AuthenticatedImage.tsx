
import React, { useState, useEffect } from 'react';
import { auth } from '../services/firebase';

interface AuthenticatedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
    src?: string;
}

export const AuthenticatedImage: React.FC<AuthenticatedImageProps> = ({ src, ...props }) => {
    const [authSrc, setAuthSrc] = useState<string | undefined>(src);

    useEffect(() => {
        let active = true;

        const resolveSrc = async () => {
            if (src && src.startsWith('/api/images/')) {
                try {
                    const token = await auth.currentUser?.getIdToken();
                    if (active && token) {
                        const separator = src.includes('?') ? '&' : '?';
                        setAuthSrc(`${src}${separator}auth_token=${token}`);
                    } else if (active) {
                        setAuthSrc(src);
                    }
                } catch (e) {
                    if (active) setAuthSrc(src);
                }
            } else {
                if (active) setAuthSrc(src);
            }
        };

        resolveSrc();
        return () => { active = false; };
    }, [src]);

    return <img src={authSrc} {...props} />;
};
