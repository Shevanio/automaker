import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { XmlSyntaxEditor } from '@/components/ui/xml-syntax-editor';
import { FileText, AlertTriangle } from 'lucide-react';

interface SpecEditorProps {
  specValue: string;
  improvementsValue: string;
  onSpecChange: (value: string) => void;
  onImprovementsChange: (value: string) => void;
}

export function SpecEditor({
  specValue,
  improvementsValue,
  onSpecChange,
  onImprovementsChange,
}: SpecEditorProps) {
  return (
    <div className="flex-1 p-4 overflow-hidden">
      <Card className="h-full flex flex-col">
        <Tabs defaultValue="spec" className="flex-1 flex flex-col">
          <TabsList className="mx-4 mt-4 w-auto self-start">
            <TabsTrigger value="spec" className="gap-2">
              <FileText className="w-4 h-4" />
              Documentation
            </TabsTrigger>
            <TabsTrigger value="improvements" className="gap-2">
              <AlertTriangle className="w-4 h-4" />
              Improvements
            </TabsTrigger>
          </TabsList>

          <TabsContent value="spec" className="flex-1 m-0 p-4 pt-2">
            <div className="h-full">
              <XmlSyntaxEditor
                value={specValue}
                onChange={onSpecChange}
                placeholder="Write your app specification here..."
                data-testid="spec-editor"
              />
            </div>
          </TabsContent>

          <TabsContent value="improvements" className="flex-1 m-0 p-4 pt-2">
            <div className="h-full">
              <XmlSyntaxEditor
                value={improvementsValue}
                onChange={onImprovementsChange}
                placeholder="Proposed improvements will appear here after multi-agent analysis..."
                data-testid="improvements-editor"
              />
            </div>
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
}
