import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';

type MarkdownContentProps = {
    content: string;
    id?: string;
};

const components: Components = {
    a: ({ children, href }) => (
        <a href={href} rel="noreferrer noopener" target="_blank">
            {children}
        </a>
    ),
};

export function MarkdownContent({ content, id }: MarkdownContentProps) {
    return (
        <div className="markdown-content" id={id}>
            <ReactMarkdown components={components} remarkPlugins={[remarkGfm]}>
                {content}
            </ReactMarkdown>
        </div>
    );
}
