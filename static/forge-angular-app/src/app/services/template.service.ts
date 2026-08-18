export const TemplateService = {
  mergeTemplate: (usedTemplate: any, newTemplate: any, cursorCursorPosition: any) => {
    let nodeToEdit = Array.isArray(usedTemplate.content) ? [...usedTemplate.content] : { ...usedTemplate.content };
    let parentNodeToEdit = usedTemplate.content; // To can append new content to the parent (binded to usedTemplate.content)
    let nodeToEditIndex;
    for (const [index, path] of Object.entries(cursorCursorPosition.lastPositionPath)) {
      const pathIndex = parseInt(index, 10);
      if (typeof path === 'object' && pathIndex < cursorCursorPosition.lastPositionPath.length - 3) {
        parentNodeToEdit = nodeToEdit.content;
        nodeToEdit = nodeToEdit.content[cursorCursorPosition.lastPositionPath[pathIndex + 1]];
        nodeToEditIndex = cursorCursorPosition.lastPositionPath[pathIndex + 1];
      }
    }

    let secondPartOfSplit = ''; // second part of a possible text to be appended
    let restOfNodeContent = []; // rest of extra content in node
    if (nodeToEdit && Array.isArray(nodeToEdit.content)) {
      if (nodeToEdit.content.length === 0) {
        newTemplate.content.content.map((addedContent: any, index: number) => {
          parentNodeToEdit.splice(nodeToEditIndex + index, 0, addedContent);
        });
        parentNodeToEdit.splice(nodeToEditIndex + newTemplate.content.content.length, 1); // Remove the last node (empty)
        console.log(parentNodeToEdit);
      } else {
        secondPartOfSplit = nodeToEdit.content[0].text.slice(cursorCursorPosition.lastPositionParentOffset);
        if (nodeToEdit.content.length > 1) {
          restOfNodeContent = [...nodeToEdit.content].slice(1);
        }
        nodeToEdit.content[0].text = nodeToEdit.content[0].text.slice(0, cursorCursorPosition.lastPositionParentOffset);
        nodeToEdit.content.length = 1; // if there is extra content in the node to be appended after, it needs to be removed from the first part
        let activeNodeIndex: number;
        parentNodeToEdit.forEach((item, index) => {
          if (item.content[0] && item.content[0].text == nodeToEdit.content[0].text) activeNodeIndex = index;
        });

        if (activeNodeIndex !== undefined) {
          for (let index = 0; index < newTemplate.content.content.length; index++) {
            const addedContent = newTemplate.content.content[index];
            parentNodeToEdit.splice(activeNodeIndex + index + 1, 0, addedContent);
          }
          if (secondPartOfSplit !== '')
            parentNodeToEdit.splice(activeNodeIndex + newTemplate.content.content.length + 1, 0, {
              type: 'paragraph',
              content: [{ type: 'text', text: secondPartOfSplit }, ...restOfNodeContent],
            });
        } else {
          newTemplate.content.content.forEach((addedContent) => {
            parentNodeToEdit.push(addedContent);
          });
          if (secondPartOfSplit !== '')
            parentNodeToEdit.push({ type: 'paragraph', content: [{ type: 'text', text: secondPartOfSplit }, ...restOfNodeContent] });
        }
      }
    } else {
      usedTemplate.content = {
        version: 1,
        type: 'doc',
        content: [...newTemplate.content.content],
      };
    }
  },
};
