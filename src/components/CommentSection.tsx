import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageSquare, Send, Edit2, Trash2, User, X, Check } from 'lucide-react';
import { collection, query, where, getDocs, addDoc, onSnapshot, orderBy, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { Comment } from '../types';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';
import { ConfirmationModal } from './ConfirmationModal';

interface CommentSectionProps {
  parentId: string;
  parentType: 'news' | 'event';
}

export const CommentSection: React.FC<CommentSectionProps> = ({ parentId, parentType }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  
  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [commentToDelete, setCommentToDelete] = useState<string | null>(null);

  useEffect(() => {
    // Admins see all comments, others see only approved ones
    const q = user?.role === 'admin'
      ? query(
          collection(db, 'comments'),
          where('parentId', '==', parentId)
        )
      : query(
          collection(db, 'comments'),
          where('parentId', '==', parentId),
          where('isApproved', '==', true)
        );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Comment));
      // Filter to show approved comments, or unapproved ones if user is admin or author
      const filteredDocs = docs.filter(c => 
        c.isApproved || user?.role === 'admin' || c.userId === user?.uid
      );
      // Sort client-side to avoid index requirement
      filteredDocs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setComments(filteredDocs);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'comments');
    });

    return () => unsubscribe();
  }, [parentId, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      navigate('/login', { 
        state: { 
          from: window.location.pathname,
          message: 'Please sign in to join the conversation and post a comment.'
        } 
      });
      return;
    }
    if (!newComment.trim()) return;

    setIsSubmitting(true);
    try {
      const commentData: any = {
        parentId,
        parentType,
        userId: user.uid,
        userName: user.name,
        content: newComment.trim(),
        isApproved: false, // Comments require admin approval
        createdAt: new Date().toISOString(),
      };
      if (user.photoURL) {
        commentData.userPhoto = user.photoURL;
      }
      
      await addDoc(collection(db, 'comments'), commentData);
      setShowSuccess(true);
      setNewComment('');
      setTimeout(() => setShowSuccess(false), 5000);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'comments');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    setCommentToDelete(commentId);
    setModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!commentToDelete) return;
    try {
      await deleteDoc(doc(db, 'comments', commentToDelete));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `comments/${commentToDelete}`);
    } finally {
      setCommentToDelete(null);
    }
  };

  const handleUpdate = async (commentId: string, updates: Partial<Comment>) => {
    try {
      await updateDoc(doc(db, 'comments', commentId), {
        ...updates,
        updatedAt: new Date().toISOString()
      });
      setEditingCommentId(null);
      setEditContent('');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `comments/${commentId}`);
    }
  };

  return (
    <section className="space-y-6">
      <div className="flex items-center gap-2">
        <MessageSquare className="w-6 h-6 text-[#e90b35]" />
        <h2 className="text-xl font-bold">Comments</h2>
      </div>

      {/* Comment Form */}
      <div className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm space-y-4">
        {showSuccess && (
          <div className="p-3 bg-green-50 text-green-700 text-xs rounded-xl border border-green-100 animate-in fade-in slide-in-from-top-2">
            Your comment has been submitted and will be visible after admin approval.
          </div>
        )}
        <div className="relative">
          <textarea
            placeholder="Write a comment..."
            className="w-full p-4 bg-gray-50 border-none rounded-2xl outline-none focus:ring-2 focus:ring-[#e90b35] h-24 resize-none text-sm"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
          />
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !newComment.trim()}
            className="absolute bottom-3 right-3 p-2 bg-[#e90b35] text-white rounded-xl shadow-lg active:scale-95 transition-all disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Comments List */}
      <div className="space-y-4">
        {comments.length > 0 ? (
          comments.map((comment) => (
            <div key={comment.id} className="bg-white p-4 rounded-2xl border border-gray-50 shadow-sm space-y-2">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-gray-100 rounded-full overflow-hidden flex items-center justify-center">
                    <span className="font-bold text-sm uppercase text-gray-500">{(comment.userName?.[0] || '?')}</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-sm">{comment.userName}</p>
                      {!comment.isApproved && (
                        <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-[8px] font-bold rounded-full uppercase tracking-widest">
                          Pending Approval
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-gray-400">{new Date(comment.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>
                {(user?.uid === comment.userId || user?.role === 'admin') && (
                  <div className="flex gap-2">
                    {user?.role === 'admin' && !comment.isApproved && (
                      <button 
                        onClick={() => handleUpdate(comment.id, { isApproved: true })}
                        className="p-1 text-green-500 hover:text-green-700 transition-colors"
                        title="Approve Comment"
                      >
                        <Check className="w-3 h-3" />
                      </button>
                    )}
                    <button 
                      onClick={() => {
                        setEditingCommentId(comment.id);
                        setEditContent(comment.content);
                      }}
                      className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>
                    <button 
                      onClick={() => handleDelete(comment.id)}
                      className="p-1 text-gray-400 hover:text-[#e90b35] transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
              {editingCommentId === comment.id ? (
                <div className="space-y-2 mt-2">
                  <textarea
                    className="w-full p-3 bg-gray-50 border-none rounded-xl outline-none focus:ring-2 focus:ring-[#e90b35] text-sm resize-none"
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <button 
                      onClick={() => handleUpdate(comment.id, { content: editContent.trim() })}
                      className="p-2 bg-[#e90b35] text-white rounded-lg shadow-sm active:scale-95 transition-all"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => setEditingCommentId(null)}
                      className="p-2 bg-gray-100 text-gray-600 rounded-lg shadow-sm active:scale-95 transition-all"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-600 whitespace-pre-wrap">{comment.content}</p>
              )}
            </div>
          ))
        ) : (
          <p className="text-gray-400 text-center py-4 text-sm italic">No comments yet. Be the first to join the conversation!</p>
        )}
      </div>

      <ConfirmationModal 
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onConfirm={confirmDelete}
        title="Delete Comment"
        message="Are you sure you want to delete this comment? This action cannot be undone."
      />
    </section>
  );
};
